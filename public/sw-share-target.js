// Service Worker handler for Web Share Target API
// This allows FUIK.IO to receive files shared from other apps (e.g., email, WhatsApp)

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only intercept POST requests to the share target URL
  if (event.request.method === 'POST' && url.pathname === '/quick-paste') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files');
    
    if (files.length > 0 && files[0] instanceof File) {
      // Cache the first file for the app to retrieve
      const cache = await caches.open('shared-files');
      
      // Store file as a Response with metadata in headers
      const file = files[0];
      const response = new Response(file, {
        headers: {
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Type': file.type,
          'Content-Type': file.type
        }
      });
      
      await cache.put('shared-po-file', response);
    }
    
    // Redirect to quick paste page with share-target indicator
    return Response.redirect('/quick-paste?share-target=true', 303);
  } catch (error) {
    console.error('Share target error:', error);
    // On error, still redirect but without the file
    return Response.redirect('/quick-paste', 303);
  }
}
