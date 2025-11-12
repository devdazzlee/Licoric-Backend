import { Shippo } from 'shippo';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Shippo client
function getShippoClient(): Shippo {
  // Use live token for testing since test tokens don't generate real tracking data
  const token = process.env.SHIPPO_LIVE_TOKEN || process.env.SHIPPO_TEST_TOKEN;
  
  if (!token) {
    throw new Error('Shippo token not configured');
  }
  
  const isLiveToken = token.startsWith('shippo_live_');
  console.log('🔑 Using Shippo token:', {
    type: isLiveToken ? 'LIVE' : 'TEST',
    token: token.substring(0, 20) + '...',
  });
  
  return new Shippo({
    apiKeyHeader: token,
    shippoApiVersion: "2018-02-08",
  });
}

// Default sender address (Update with your business address)
const DEFAULT_SENDER_ADDRESS = {
  name: 'Southern Sweet and Sour',
  company: 'Southern Sweet and Sour LLC',
  email: 'Info@southernsweetandsour.com',
  phone: '+1 919-701-9321',
  street1: '4363 Ocean Farm Dr',
  street2: '',
  city: 'Summerville',
  state: 'SC',
  zip: '29485',
  country: 'US',
};

export interface ShippingAddress {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ShipmentData {
  orderId: string;
  toAddress: ShippingAddress;
  parcels: Array<{
    length: string;
    width: string;
    height: string;
    weight: string;
    massUnit: 'lb' | 'kg';
    distanceUnit: 'in' | 'cm';
  }>;
}

// Validate shipping address
export const validateAddress = async (address: ShippingAddress) => {
  try {
    const shippo = getShippoClient();
    
    const validationResult = await shippo.addresses.create({
      name: address.name,
      company: address.company || '',
      street1: address.street1,
      street2: address.street2 || '',
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      email: address.email,
      phone: address.phone || '',
    });

    // More lenient validation - accept address if it has basic required fields
    const hasRequiredFields = !!(
      validationResult.name &&
      validationResult.street1 &&
      validationResult.city &&
      validationResult.state &&
      validationResult.zip &&
      validationResult.country
    );

    return {
      isValid: hasRequiredFields || validationResult.isComplete,
      validatedAddress: validationResult,
      suggestions: [],
    };
  } catch (error) {
    console.error('Address validation error:', error);
    
    // If Shippo validation fails, do basic validation instead
    const hasRequiredFields = !!(
      address.name &&
      address.street1 &&
      address.city &&
      address.state &&
      address.zip &&
      address.country
    );
    
    return {
      isValid: hasRequiredFields,
      validatedAddress: address,
      suggestions: [],
    };
  }
};

// Get shipping rates
export const getShippingRates = async (toAddress: ShippingAddress, parcels: ShipmentData['parcels']) => {
  try {
    const shippo = getShippoClient();
    
    console.log('🚚 Creating Shippo shipment request for rates');
    
    // Create shipment for rate calculation
    const shipment = await shippo.shipments.create({
      addressFrom: DEFAULT_SENDER_ADDRESS,
      addressTo: {
        name: toAddress.name,
        company: toAddress.company || '',
        street1: toAddress.street1,
        street2: toAddress.street2 || '',
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.zip,
        country: toAddress.country,
        email: toAddress.email,
        phone: toAddress.phone || '',
      },
      parcels: parcels,
    });

    console.log('📦 Shippo shipment response:', {
      objectId: shipment.objectId,
      status: shipment.status,
      ratesCount: shipment.rates?.length || 0,
    });

    return shipment.rates.map((rate: any) => ({
      objectId: rate.objectId || rate.object_id,
      serviceName: rate.servicelevel?.name || rate.servicelevelName || rate.servicelevel_name || rate.attributes?.join(', ') || 'Standard Shipping',
      serviceToken: rate.servicelevel?.token || rate.servicelevelToken || rate.servicelevel_token || '',
      carrier: rate.provider || rate.carrier || 'USPS',
      amount: parseFloat(rate.amount || '0'),
      currency: rate.currency || 'USD',
      estimatedDays: rate.estimatedDays || rate.estimated_days || rate.duration_terms || 3,
      durationTerms: rate.durationTerms || rate.duration_terms || '',
    }));
  } catch (error: any) {
    console.error('❌ Shipping rates error:', {
      message: error.message,
      status: error.status,
    });
    throw new Error('Failed to get shipping rates');
  }
};

// Create shipment and purchase label
export const createShipment = async (
  shipmentData: ShipmentData, 
  selectedRateId: string,
  selectedRateData?: { carrier: string; amount: number; serviceName: string }
) => {
  try {
    const shippo = getShippoClient();
    
    // Validate address data before creating transaction
    const address = shipmentData.toAddress;
    if (!address.name || !address.street1 || !address.city || !address.state || !address.zip || !address.country) {
      throw new Error('Invalid address data: Missing required fields');
    }
    
    console.log('📦 Creating shipment for order:', shipmentData.orderId);
    
    // Create shipment with proper configuration
    const shipment = await shippo.shipments.create({
      addressFrom: DEFAULT_SENDER_ADDRESS,
      addressTo: {
        name: shipmentData.toAddress.name,
        company: shipmentData.toAddress.company || '',
        street1: shipmentData.toAddress.street1,
        street2: shipmentData.toAddress.street2 || '',
        city: shipmentData.toAddress.city,
        state: shipmentData.toAddress.state,
        zip: shipmentData.toAddress.zip,
        country: shipmentData.toAddress.country,
        email: shipmentData.toAddress.email,
        phone: shipmentData.toAddress.phone || '',
        isResidential: true,
      },
      parcels: shipmentData.parcels,
      extra: {
        bypassAddressValidation: true
      },
      metadata: `Order ${shipmentData.orderId}`,
      shipmentDate: new Date().toISOString(),
    });

    // Purchase the selected rate
    console.log('💳 Creating Shippo transaction for rate:', selectedRateId);
    
    const transaction = await shippo.transactions.create({
      rate: selectedRateId,
      labelFileType: 'PDF',
      metadata: `Order ${shipmentData.orderId}`,
    });

    console.log('🔍 Transaction response:', {
      objectId: transaction.objectId,
      trackingNumber: transaction.trackingNumber,
      status: transaction.status,
    });

    // Handle QUEUED transactions - wait for completion
    if (transaction.status === 'QUEUED') {
      console.log('⏳ Transaction is QUEUED, waiting for completion...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      try {
        if (transaction.objectId) {
          const completedTransaction = await shippo.transactions.get(transaction.objectId);
          Object.assign(transaction, completedTransaction);
        }
      } catch (retryError) {
        console.log('⚠️ Could not get completed transaction, using QUEUED data');
      }
    }

    // Check if transaction failed
    if (transaction.status === 'ERROR') {
      console.error('❌ Shippo transaction failed');
      const errorMessage = transaction.messages?.map(m => `${m.source}: ${m.text}`).join('; ') || 'Unknown error';
      throw new Error(`Shippo transaction failed: ${errorMessage}`);
    }

    // Only proceed if transaction is successful
    if (transaction.status !== 'SUCCESS') {
      throw new Error(`Shippo transaction not successful: ${transaction.status}`);
    }

    // Get tracking data
    const trackingNumber = transaction.trackingNumber;
    if (!trackingNumber) {
      throw new Error('No tracking number provided by Shippo');
    }
    
    // Generate tracking URL
    let trackingUrl = transaction.trackingUrlProvider;
    if (!trackingUrl && trackingNumber) {
      const carrier = (typeof transaction.rate === 'object' ? transaction.rate?.provider : '') || '';
      
      switch (carrier?.toLowerCase()) {
        case 'usps':
          trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
          break;
        case 'ups':
          trackingUrl = `https://www.ups.com/track?track=yes&trackNums=${trackingNumber}`;
          break;
        case 'fedex':
          trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
          break;
        default:
          trackingUrl = `https://goshippo.com/track/${trackingNumber}`;
      }
    }
    
    if (!trackingUrl) {
      trackingUrl = `https://goshippo.com/track/${trackingNumber}`;
    }
    
    const labelUrl = transaction.labelUrl || `https://goshippo.com/label/${transaction.objectId || 'unknown'}`;

    // Extract carrier and service information
    const carrier = selectedRateData?.carrier || 
                    (typeof transaction.rate === 'object' ? transaction.rate?.provider : '') || 
                    'Unknown';
    const service = selectedRateData?.serviceName || 
                    (typeof transaction.rate === 'object' ? transaction.rate?.servicelevelName : '') || 
                    'Standard';
    const cost = selectedRateData?.amount || 
                 (typeof transaction.rate === 'object' ? parseFloat(transaction.rate?.amount || '0') : 0) || 
                 0;

    console.log('📦 Shipment details:', {
      carrier,
      service,
      cost,
      trackingNumber,
    });

    // Update order with shipment data
    await prisma.order.update({
      where: { id: shipmentData.orderId },
      data: {
        shipmentId: transaction.objectId,
        trackingNumber: trackingNumber,
        trackingUrl: trackingUrl,
        shippingLabelUrl: labelUrl,
        shippingCarrier: carrier,
        shippingService: service,
        shippingCost: cost,
      },
    });

      return {
      shipmentId: transaction.objectId,
      trackingNumber: trackingNumber,
      trackingUrl: trackingUrl,
      labelUrl: labelUrl,
      status: 'label_created',
    };
  } catch (error: any) {
    console.error('❌ Shipment creation error:', error?.message || error);
    throw new Error('Failed to create shipment');
  }
};

// Get shipment status
export const getShipmentStatus = async (shipmentId: string) => {
  try {
    const shippo = getShippoClient();
    
    const transaction = await shippo.transactions.get(shipmentId);

      return {
      status: transaction.status,
      trackingNumber: transaction.trackingNumber,
      trackingUrl: transaction.trackingUrlProvider,
      labelUrl: transaction.labelUrl,
      carrier: typeof transaction.rate === 'object' ? transaction.rate?.provider || '' : '',
      service: typeof transaction.rate === 'object' ? transaction.rate?.servicelevelName || '' : '',
      };
    } catch (error) {
    console.error('Shipment status error:', error);
    throw new Error('Failed to get shipment status');
  }
};

// Handle webhook events
export const handleWebhookEvent = async (eventType: string, data: any) => {
  try {
    console.log(`📦 Shippo webhook received: ${eventType}`, {
      objectId: data.object_id,
      trackingNumber: data.tracking_number,
      status: data.status,
    });
    
    // Handle both underscore and dot notation
    const normalizedEvent = eventType.replace('.', '_');
    
    switch (normalizedEvent) {
      case 'transaction_created':
        await handleTransactionCreated(data);
        break;
      case 'transaction_updated':
        await handleTransactionUpdated(data);
        break;
      case 'track_updated':
        await handleTrackUpdated(data);
        break;
      default:
        console.log(`ℹ️ Unhandled webhook event: ${eventType}`);
    }
  } catch (error) {
    console.error('❌ Webhook handling error:', error);
    throw error;
  }
};

const handleTransactionCreated = async (data: any) => {
  // Transaction created - label is ready, update order with tracking info
  console.log('📦 Processing transaction_created webhook:', {
    objectId: data.object_id,
    trackingNumber: data.tracking_number,
    trackingUrl: data.tracking_url_provider,
    labelUrl: data.label_url,
    status: data.status,
  });

  // First, check if order already has this tracking info (likely updated by payment webhook)
  const existingOrder = await prisma.order.findFirst({
    where: {
      AND: [
        { shipmentId: data.object_id },
        { trackingNumber: data.tracking_number },
      ],
    },
  });

  if (existingOrder) {
    console.log('ℹ️ Order already has tracking info (updated by payment webhook):', {
      orderId: existingOrder.id,
      orderNumber: existingOrder.orderNumber,
      trackingNumber: existingOrder.trackingNumber,
      note: 'Webhook arrived after order was already updated - this is normal'
    });
    return; // Already updated, nothing to do
  }

  // Find order by shipment ID (rate ID) or transaction ID (if not already updated)
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { shipmentId: data.object_id },
        { shipmentId: data.rate },
      ],
    },
  });

  if (order) {
    console.log('✅ Found order to update with webhook data:', order.id);
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        trackingNumber: data.tracking_number || null,
        trackingUrl: data.tracking_url_provider || null,
        shippingLabelUrl: data.label_url || null,
        shipmentId: data.object_id, // Update to transaction ID
        updatedAt: new Date(),
      },
    });
    
    console.log('✅ Order updated with tracking info from webhook');
  } else {
    console.log('ℹ️ No pending order found for this shipment - likely already updated:', {
      transactionId: data.object_id,
      rateId: data.rate,
      note: 'This usually means the order was already updated in the payment webhook (expected behavior)'
    });
  }
};

const handleTransactionUpdated = async (data: any) => {
  // Transaction updated - status changed
  console.log('📦 Processing transaction_updated webhook');
  
  await prisma.order.updateMany({
    where: { shipmentId: data.object_id },
    data: {
      trackingNumber: data.tracking_number || undefined,
      trackingUrl: data.tracking_url_provider || undefined,
      updatedAt: new Date(),
    },
  });
};

const handleTrackUpdated = async (data: any) => {
  // Tracking updated - delivery status changed
  console.log('📦 Processing track_updated webhook');
  
  await prisma.order.updateMany({
    where: { trackingNumber: data.tracking_number },
    data: {
      trackingUrl: data.tracking_url_provider || undefined,
      updatedAt: new Date(),
    },
  });
};
