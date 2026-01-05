import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - production and staging domains
const allowedOrigins = [
  'https://fuik.io',
  'https://www.fuik.io',
  'https://dnxzpkbobzwjcuyfgdnh.lovable.app'
];

// Check if origin matches allowed patterns (including Lovable preview domains)
function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true;
  
  // Allow any lovableproject.com subdomain (preview environments)
  if (origin.endsWith('.lovableproject.com')) return true;
  
  // Allow any lovable.app subdomain
  if (origin.endsWith('.lovable.app')) return true;
  
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Default CORS headers for preflight
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two coordinates in meters
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface Zone {
  id: string;
  name: string;
  zone_type: string;
  parent_zone_id: string | null;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  matchedZone: string | null;
  matchedMajorZoneId: string | null;
  matchedMajorZoneName: string | null;
  distance: number | null;
  allZoneDistances: { name: string; distance: number; withinRadius: boolean; majorZoneId?: string }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      console.error('MAPBOX_PUBLIC_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { address, customerId } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Geocoding address: ${address}`);

    // Geocode the address using Mapbox
    // Using Curaçao country code and proximity to center of island
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?` +
      `country=CW&proximity=-68.95,12.17&limit=1&access_token=${mapboxToken}`;

    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    console.log('Mapbox response:', JSON.stringify(geocodeData));

    if (!geocodeData.features || geocodeData.features.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Address not found',
          message: 'Could not locate this address. Please check the address and try again.'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [longitude, latitude] = geocodeData.features[0].center;
    console.log(`Coordinates found: ${latitude}, ${longitude}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active delivery zones (both major and sub)
    const { data: zones, error: zonesError } = await supabase
      .from('fnb_delivery_zones')
      .select('id, name, zone_type, parent_zone_id, center_latitude, center_longitude, radius_meters')
      .eq('is_active', true)
      .not('center_latitude', 'is', null)
      .not('center_longitude', 'is', null);

    if (zonesError) {
      console.error('Error fetching zones:', zonesError);
      throw zonesError;
    }

    // Create a map of zone IDs to zone data for quick lookup
    const zoneMap = new Map((zones as Zone[]).map(z => [z.id, z]));

    // Calculate distance to each zone and find matches
    // Prioritize sub-zones over major zones for matching
    const subZones = (zones as Zone[]).filter(z => z.zone_type === 'sub');
    const majorZones = (zones as Zone[]).filter(z => z.zone_type === 'major');

    const zoneDistances = [...subZones, ...majorZones].map(zone => {
      const distance = getDistanceMeters(
        latitude, 
        longitude, 
        zone.center_latitude, 
        zone.center_longitude
      );
      
      // Get parent major zone info if this is a sub-zone
      let majorZoneId: string | undefined;
      if (zone.zone_type === 'sub' && zone.parent_zone_id) {
        majorZoneId = zone.parent_zone_id;
      } else if (zone.zone_type === 'major') {
        majorZoneId = zone.id;
      }

      return {
        id: zone.id,
        name: zone.name,
        zoneType: zone.zone_type,
        parentZoneId: zone.parent_zone_id,
        majorZoneId,
        distance: Math.round(distance),
        withinRadius: distance <= (zone.radius_meters || 1000)
      };
    }).sort((a, b) => a.distance - b.distance);

    // Find the closest zone that the address falls within (prefer sub-zones)
    const matchingZone = zoneDistances.find(z => z.withinRadius);
    
    // Determine the major zone
    let matchedMajorZoneId: string | null = null;
    let matchedMajorZoneName: string | null = null;
    
    if (matchingZone) {
      if (matchingZone.zoneType === 'sub' && matchingZone.parentZoneId) {
        matchedMajorZoneId = matchingZone.parentZoneId;
        const parentZone = zoneMap.get(matchingZone.parentZoneId);
        matchedMajorZoneName = parentZone?.name || null;
      } else if (matchingZone.zoneType === 'major') {
        matchedMajorZoneId = matchingZone.id;
        matchedMajorZoneName = matchingZone.name;
      }
    }

    const result: GeocodeResult = {
      latitude,
      longitude,
      matchedZone: matchingZone?.name || null,
      matchedMajorZoneId,
      matchedMajorZoneName,
      distance: matchingZone?.distance || zoneDistances[0]?.distance || null,
      allZoneDistances: zoneDistances.slice(0, 5).map(z => ({
        name: z.name,
        distance: z.distance,
        withinRadius: z.withinRadius,
        majorZoneId: z.majorZoneId
      }))
    };

    // If customerId provided, update the customer record with coordinates and zones
    if (customerId && result.latitude && result.longitude) {
      const updateData: Record<string, any> = {
        latitude: result.latitude,
        longitude: result.longitude
      };
      
      // Set major zone if detected
      if (matchedMajorZoneId) {
        updateData.major_zone_id = matchedMajorZoneId;
      }
      
      // Set sub-zone name if matched
      if (result.matchedZone) {
        updateData.delivery_zone = result.matchedZone;
      }

      const { error: updateError } = await supabase
        .from('fnb_customers')
        .update(updateData)
        .eq('id', customerId);

      if (updateError) {
        console.error('Error updating customer:', updateError);
        // Don't fail the whole request, just log the error
      } else {
        console.log(`Updated customer ${customerId} with coordinates, major zone ${matchedMajorZoneName}, and sub-zone ${result.matchedZone}`);
      }
    }

    console.log('Geocode result:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in geocode-address function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});