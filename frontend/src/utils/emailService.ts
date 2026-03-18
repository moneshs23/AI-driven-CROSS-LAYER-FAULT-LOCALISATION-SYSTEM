import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_1ts717f';
const TEMPLATE_ID = 'template_1yox85z';
const PUBLIC_KEY = 'D6kcrAhqZNMIwSSFl';

// Initialize EmailJS with the public key
emailjs.init(PUBLIC_KEY);

export interface FaultReportDetails {
  severity: string;
  layer_type: string;
  sector: string;
  specific_error: string;
  fault_label: string;
  confidence: string;
  time: string;
}

export const sendFaultReportEmail = async (details: FaultReportDetails): Promise<boolean> => {
  try {
    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        severity: details.severity,
        layer_type: details.layer_type,
        sector: details.sector,
        specific_error: details.specific_error,
        fault_label: details.fault_label,
        confidence: details.confidence,
        time: details.time,
      }
    );
    console.log('SUCCESS! Fault report sent.', response.status, response.text);
    return true;
  } catch (error) {
    console.error('FAILED to send fault report.', error);
    return false;
  }
};
