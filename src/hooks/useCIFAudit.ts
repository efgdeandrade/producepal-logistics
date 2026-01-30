/**
 * CIF Audit Hook
 * 
 * Provides functions to log CIF calculations and anomalies to the database
 * for audit trail and debugging purposes.
 */

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

export interface CIFAuditLogEntry {
  orderId: string;
  calculationType: 'estimate' | 'actual';
  exchangeRateUsed: number;
  totalFreightUsd: number;
  distributionMethod: string;
  blendRatio?: number;
  productsInput: any[];
  productsOutput: any[];
  validationStatus: 'passed' | 'warnings' | 'failed';
  validationMessages?: any[];
  learningAdjustmentsApplied?: Record<string, any>;
}

export interface CIFAnomalyEntry {
  orderId: string;
  productCode: string;
  supplierId?: string;
  estimatedCifXcg: number;
  actualCifXcg: number;
  variancePercentage: number;
  anomalyType: 'high_variance' | 'negative_margin' | 'missing_data' | 'learning_cap_exceeded';
  severity: 'info' | 'warning' | 'critical';
}

export function useCIFAudit() {
  const { user } = useAuth();

  /**
   * Log a CIF calculation to the audit trail
   */
  const logCalculation = useCallback(async (entry: CIFAuditLogEntry): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('cif_audit_log')
        .insert({
          order_id: entry.orderId,
          calculation_type: entry.calculationType,
          exchange_rate_used: entry.exchangeRateUsed,
          total_freight_usd: entry.totalFreightUsd,
          distribution_method: entry.distributionMethod,
          blend_ratio: entry.blendRatio,
          products_input: entry.productsInput,
          products_output: entry.productsOutput,
          validation_status: entry.validationStatus,
          validation_messages: entry.validationMessages || [],
          learning_adjustments_applied: entry.learningAdjustmentsApplied || {},
          created_by: user?.id,
        });

      if (error) {
        console.error('Failed to log CIF calculation:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error logging CIF calculation:', err);
      return false;
    }
  }, [user?.id]);

  /**
   * Log a CIF anomaly for review
   */
  const logAnomaly = useCallback(async (entry: CIFAnomalyEntry): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('cif_anomalies')
        .insert({
          order_id: entry.orderId,
          product_code: entry.productCode,
          supplier_id: entry.supplierId,
          estimated_cif_xcg: entry.estimatedCifXcg,
          actual_cif_xcg: entry.actualCifXcg,
          variance_percentage: entry.variancePercentage,
          anomaly_type: entry.anomalyType,
          severity: entry.severity,
          excluded_from_learning: true, // Always exclude anomalies from learning
        });

      if (error) {
        console.error('Failed to log CIF anomaly:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error logging CIF anomaly:', err);
      return false;
    }
  }, []);

  /**
   * Log multiple anomalies at once
   */
  const logAnomalies = useCallback(async (entries: CIFAnomalyEntry[]): Promise<boolean> => {
    if (entries.length === 0) return true;

    try {
      const { error } = await supabase
        .from('cif_anomalies')
        .insert(
          entries.map(entry => ({
            order_id: entry.orderId,
            product_code: entry.productCode,
            supplier_id: entry.supplierId,
            estimated_cif_xcg: entry.estimatedCifXcg,
            actual_cif_xcg: entry.actualCifXcg,
            variance_percentage: entry.variancePercentage,
            anomaly_type: entry.anomalyType,
            severity: entry.severity,
            excluded_from_learning: true,
          }))
        );

      if (error) {
        console.error('Failed to log CIF anomalies:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error logging CIF anomalies:', err);
      return false;
    }
  }, []);

  /**
   * Fetch audit history for an order
   */
  const getOrderAuditHistory = useCallback(async (orderId: string) => {
    const { data, error } = await supabase
      .from('cif_audit_log')
      .select('*')
      .eq('order_id', orderId)
      .order('calculation_timestamp', { ascending: false });

    if (error) {
      console.error('Failed to fetch audit history:', error);
      return [];
    }

    return data || [];
  }, []);

  /**
   * Fetch unreviewed anomalies
   */
  const getUnreviewedAnomalies = useCallback(async (limit: number = 50) => {
    const { data, error } = await supabase
      .from('cif_anomalies')
      .select('*')
      .eq('reviewed', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch anomalies:', error);
      return [];
    }

    return data || [];
  }, []);

  /**
   * Mark anomaly as reviewed
   */
  const markAnomalyReviewed = useCallback(async (
    anomalyId: string, 
    notes?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('cif_anomalies')
        .update({
          reviewed: true,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq('id', anomalyId);

      if (error) {
        console.error('Failed to mark anomaly as reviewed:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error marking anomaly as reviewed:', err);
      return false;
    }
  }, [user?.id]);

  return {
    logCalculation,
    logAnomaly,
    logAnomalies,
    getOrderAuditHistory,
    getUnreviewedAnomalies,
    markAnomalyReviewed,
  };
}
