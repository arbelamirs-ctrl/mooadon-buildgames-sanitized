/**
 * Transaction Flow State Machine
 * Defines states, transitions, and handlers for the POS transaction flow
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// State definitions
export const States = {
  START: 'START',
  GET_PHONE: 'GET_PHONE',
  IDENTIFY_CUSTOMER: 'IDENTIFY_CUSTOMER',
  GET_AMOUNT: 'GET_AMOUNT',
  GET_REWARD_TYPE: 'GET_REWARD_TYPE',
  CONFIRM: 'CONFIRM',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR'
} as const;

// Event/Action definitions
export const Events = {
  START_TRANSACTION: 'START_TRANSACTION',
  PHONE_RECEIVED: 'PHONE_RECEIVED',
  CANCEL: 'CANCEL',
  CUSTOMER_IDENTIFIED: 'CUSTOMER_IDENTIFIED',
  AMOUNT_RECEIVED: 'AMOUNT_RECEIVED',
  REWARD_TYPE_SELECTED: 'REWARD_TYPE_SELECTED',
  CONFIRM_TRANSACTION: 'CONFIRM_TRANSACTION',
  TRANSACTION_SUCCESS: 'TRANSACTION_SUCCESS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED'
} as const;

export interface FlowContext {
  client_phone?: string;
  amount?: number;
  reward_type?: 'token' | 'coupon';
  company_id?: string;
  branch_id?: string;
  session_id?: string;
  [key: string]: any;
}

export interface FlowResult {
  nextState: string;
  reply: string;
  context: FlowContext;
}

// Validators
const validators = {
  phone: (phone: string): boolean => {
    const phoneRegex = /^(\+?972|0)?[5][0-9]{8}$/;
    const cleanPhone = phone.replace(/[-\s]/g, '');
    return phoneRegex.test(cleanPhone);
  },

  amount: (amount: string): boolean => {
    const parsed = parseFloat(amount.replace(/[^\d.]/g, ''));
    return !isNaN(parsed) && parsed > 0;
  },

  confirmationKeyword: (message: string): 'confirm' | 'cancel' | 'invalid' => {
    const lower = message.toLowerCase();
    if (lower.includes('אישור') || lower.includes('confirm')) return 'confirm';
    if (lower.includes('ביטול') || lower.includes('cancel')) return 'cancel';
    return 'invalid';
  }
};

// Utility: normalize phone inline (consistent with validators.ts logic)
function normalizePhone(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.substring(1);
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 10) return '+972' + digits.substring(1);
  if (digits.length === 9 && digits.startsWith('5')) return '+972' + digits;
  if (digits.length >= 10) return '+' + digits;
  return '+' + digits;
}

// State Handlers
async function handleStart(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  return {
    nextState: States.GET_PHONE,
    reply: `💳 *יצירת עסקה חדשה*

מה מספר הטלפון של הלקוח?
(או שלח "ביטול" לביטול)`,
    context
  };
}

async function handleGetPhone(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  // Check for cancellation
  if (message.toLowerCase() === 'ביטול' || message.toLowerCase() === 'cancel') {
    return {
      nextState: States.CANCELLED,
      reply: '❌ העסקה בוטלה.',
      context
    };
  }

  // Validate phone
  if (!validators.phone(message)) {
    return {
      nextState: States.GET_PHONE,
      reply: '❌ מספר טלפון לא תקין. נסה שוב:',
      context
    };
  }

  // Normalize and store phone
  const cleanPhone = normalizePhone(message);
  const updatedContext = { ...context, client_phone: cleanPhone };

  return {
    nextState: States.IDENTIFY_CUSTOMER,
    reply: `✅ טלפון: ${cleanPhone}

מה סכום הרכישה? (בשקלים)`,
    context: updatedContext
  };
}

async function handleIdentifyCustomer(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  // In this simplified flow, customer identification happens inline
  // Move directly to amount capture
  return {
    nextState: States.GET_AMOUNT,
    reply: '', // No message needed, already shown in previous step
    context
  };
}

async function handleGetAmount(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  // Validate amount
  if (!validators.amount(message)) {
    return {
      nextState: States.GET_AMOUNT,
      reply: '❌ סכום לא תקין. שלח מספר (למשל: 100):',
      context
    };
  }

  const amount = parseFloat(message.replace(/[^\d.]/g, ''));
  const expectedTokens = Math.floor(amount * 10); // 1 ILS = 10 tokens
  const updatedContext = { ...context, amount };

  return {
    nextState: States.GET_REWARD_TYPE,
    reply: `✅ סכום: ₪${amount}
🪙 נקודות: ${expectedTokens}

מה סוג התגמול?
1️⃣ נקודות (ברירת מחדל)
2️⃣ קופון הנחה`,
    context: updatedContext
  };
}

async function handleGetRewardType(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  let reward_type: 'token' | 'coupon' = 'token';
  if (message === '2' || message.includes('קופון')) {
    reward_type = 'coupon';
  }

  const updatedContext = { ...context, reward_type };

  return {
    nextState: States.CONFIRM,
    reply: `✅ סוג תגמול: ${reward_type === 'token' ? 'נקודות' : 'קופון'}

אישור העסקה:
📱 לקוח: ${context.client_phone}
💰 סכום: ₪${context.amount}
🎁 תגמול: ${reward_type === 'token' ? 'נקודות' : 'קופון'}

שלח "אישור" ליצירת העסקה או "ביטול" לביטול.`,
    context: updatedContext
  };
}

async function handleConfirm(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  const confirmation = validators.confirmationKeyword(message);

  if (confirmation === 'cancel') {
    return {
      nextState: States.CANCELLED,
      reply: '❌ העסקה בוטלה.',
      context
    };
  }

  if (confirmation === 'invalid') {
    return {
      nextState: States.CONFIRM,
      reply: '❓ שלח "אישור" או "ביטול"',
      context
    };
  }

  // Proceed to processing
  return {
    nextState: States.PROCESSING,
    reply: '⏳ יוצר עסקה...',
    context
  };
}

async function handleProcessing(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  const base44 = createClientFromRequest(req);

  try {
    // Get session to find company and branch
    const sessions = await base44.asServiceRole.entities.ConversationSession.filter({ 
      id: context.session_id 
    });
    
    if (sessions.length === 0) {
      return {
        nextState: States.ERROR,
        reply: '❌ שגיאה: סשן לא נמצא',
        context
      };
    }
    const session = sessions[0];

    // Get user's branch
    const branches = await base44.asServiceRole.entities.Branch.filter({
      company_id: session.company_id
    });

    if (branches.length === 0) {
      return {
        nextState: States.ERROR,
        reply: '❌ שגיאה: לא נמצא סניף',
        context
      };
    }

    const branch_id = branches[0].id;

    // Create transaction
    const txResponse = await base44.asServiceRole.functions.invoke('createPOSTransaction', {
      phone: context.client_phone,
      amount: context.amount,
      company_id: session.company_id,
      branch_id: branch_id,
      reward_type: context.reward_type,
      order_id: `BOT-${Date.now()}`
    });

    if (!txResponse.data.success) {
      return {
        nextState: States.ERROR,
        reply: `❌ שגיאה ביצירת העסקה: ${txResponse.data.error}`,
        context
      };
    }

    const tx = txResponse.data;
    const updatedContext = { ...context, transaction_id: tx.transaction_id };

    let reply: string;
    if (context.reward_type === 'token') {
      reply = `✅ *העסקה נוצרה בהצלחה!*

💳 מזהה עסקה: ${tx.transaction_id}
📱 לקוח: ${context.client_phone}
💰 סכום: ₪${context.amount}
🪙 נקודות: ${tx.tokens}
${tx.blockchain_success ? '✅ נשלח לבלוקצ\'יין' : '⚠️ ממתין לבלוקצ\'יין'}

הלקוח קיבל הודעת WhatsApp עם הפרטים.`;
    } else {
      reply = `✅ *העסקה נוצרה בהצלחה!*

💳 מזהה עסקה: ${tx.transaction_id}
📱 לקוח: ${context.client_phone}
💰 סכום: ₪${context.amount}
🎟️ קופון: ${tx.coupon?.code}
📉 הנחה: ${tx.coupon?.discount_value}%

הלקוח קיבל הודעת WhatsApp עם הקופון.`;
    }

    return {
      nextState: States.COMPLETED,
      reply,
      context: updatedContext
    };

  } catch (error) {
    console.error('Processing error:', error);
    return {
      nextState: States.ERROR,
      reply: `❌ שגיאה: ${error.message}`,
      context
    };
  }
}

async function handleCompleted(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  return {
    nextState: States.COMPLETED,
    reply: 'העסקה הושלמה.',
    context
  };
}

async function handleError(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  return {
    nextState: States.ERROR,
    reply: '❌ שגיאה בתהליך. אנא התחל מחדש.',
    context
  };
}

async function handleCancelled(
  req: Request,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  return {
    nextState: States.CANCELLED,
    reply: 'העסקה בוטלה.',
    context
  };
}

// State Machine Configuration
export const stateMachine = {
  [States.START]: {
    handler: handleStart,
    transitions: {
      [Events.START_TRANSACTION]: States.GET_PHONE
    }
  },
  [States.GET_PHONE]: {
    handler: handleGetPhone,
    transitions: {
      [Events.PHONE_RECEIVED]: States.IDENTIFY_CUSTOMER,
      [Events.CANCEL]: States.CANCELLED
    }
  },
  [States.IDENTIFY_CUSTOMER]: {
    handler: handleIdentifyCustomer,
    transitions: {
      [Events.CUSTOMER_IDENTIFIED]: States.GET_AMOUNT
    }
  },
  [States.GET_AMOUNT]: {
    handler: handleGetAmount,
    transitions: {
      [Events.AMOUNT_RECEIVED]: States.GET_REWARD_TYPE
    }
  },
  [States.GET_REWARD_TYPE]: {
    handler: handleGetRewardType,
    transitions: {
      [Events.REWARD_TYPE_SELECTED]: States.CONFIRM
    }
  },
  [States.CONFIRM]: {
    handler: handleConfirm,
    transitions: {
      [Events.CONFIRM_TRANSACTION]: States.PROCESSING,
      [Events.CANCEL]: States.CANCELLED
    }
  },
  [States.PROCESSING]: {
    handler: handleProcessing,
    transitions: {
      [Events.TRANSACTION_SUCCESS]: States.COMPLETED,
      [Events.TRANSACTION_FAILED]: States.ERROR
    }
  },
  [States.COMPLETED]: {
    handler: handleCompleted,
    transitions: {}
  },
  [States.CANCELLED]: {
    handler: handleCancelled,
    transitions: {}
  },
  [States.ERROR]: {
    handler: handleError,
    transitions: {}
  }
};

/**
 * Execute state machine
 * @param req - HTTP request
 * @param currentState - Current state
 * @param message - User message
 * @param context - Flow context
 * @returns Flow result with next state, reply, and updated context
 */
export async function executeStateMachine(
  req: Request,
  currentState: string,
  message: string,
  context: FlowContext
): Promise<FlowResult> {
  const state = stateMachine[currentState];

  if (!state) {
    console.error('Invalid state:', currentState);
    return {
      nextState: States.ERROR,
      reply: '❌ שגיאה בתהליך',
      context
    };
  }

  try {
    return await state.handler(req, message, context);
  } catch (error) {
    console.error('State handler error:', error);
    return {
      nextState: States.ERROR,
      reply: '❌ שגיאה בתהליך. אנא נסה שוב.',
      context
    };
  }
}