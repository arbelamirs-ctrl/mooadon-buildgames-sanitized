// Campaign template definitions — vertical-aware
export const CAMPAIGN_TEMPLATES = [
  {
    id: 'daily_special',
    name: 'Daily Special / Today Only',
    emoji: '⚡',
    objective: 'traffic',
    angle: 'scarcity',
    description: 'Create urgency around a limited-time daily offer',
    best_for: ['cafe', 'restaurant', 'fashion'],
    platform_notes: 'IG Stories + FB. Short punchy copy. Countdown vibe.',
    prompt_hint: 'Emphasize TODAY ONLY urgency. Time is the hook.'
  },
  {
    id: 'new_arrival',
    name: 'New Arrival',
    emoji: '✨',
    objective: 'awareness',
    angle: 'benefit',
    description: 'Introduce a new product with excitement and curiosity',
    best_for: ['fashion', 'jewelry', 'cafe'],
    platform_notes: 'IG + LinkedIn. Show the product prominently.',
    prompt_hint: 'Lead with novelty and exclusivity. First to know angle.'
  },
  {
    id: 'happy_hour',
    name: 'Happy Hour / Limited Time',
    emoji: '🕐',
    objective: 'traffic',
    angle: 'scarcity',
    description: 'Drive foot traffic in a specific window of time',
    best_for: ['cafe', 'restaurant', 'other'],
    platform_notes: 'IG Stories. Location tag. Time-specific copy.',
    prompt_hint: 'Hours and location are the core. Make them feel they will miss out.'
  },
  {
    id: 'gift_occasion',
    name: 'Gift / Occasion',
    emoji: '🎁',
    objective: 'conversion',
    angle: 'story',
    description: 'Connect your product to a special moment or holiday',
    best_for: ['jewelry', 'fashion', 'other'],
    platform_notes: 'All platforms. Emotional, warm tone.',
    prompt_hint: 'Emotional hook: this is the perfect gift. Make it personal.'
  },
  {
    id: 'weekend_push',
    name: 'Weekend Push',
    emoji: '🎉',
    objective: 'traffic',
    angle: 'benefit',
    description: 'Energize weekend sales with a fun, casual offer',
    best_for: ['cafe', 'restaurant', 'fashion'],
    platform_notes: 'IG + FB. Casual, upbeat tone. Fun vibe.',
    prompt_hint: 'Weekend energy. Treat yourself angle. Light and fun.'
  },
  {
    id: 'vip_members',
    name: 'VIP / Members Only',
    emoji: '👑',
    objective: 'loyalty',
    angle: 'social_proof',
    description: 'Reward loyal customers with an exclusive offer',
    best_for: ['fashion', 'cafe', 'jewelry'],
    platform_notes: 'IG + email. Exclusive, premium tone.',
    prompt_hint: 'Make them feel special and chosen. Exclusivity is the hook.'
  },
  {
    id: 'comeback',
    name: 'Come-Back Offer',
    emoji: '🔄',
    objective: 'reactivation',
    angle: 'story',
    description: 'Re-engage customers who haven\'t visited in a while',
    best_for: ['cafe', 'restaurant', 'fashion'],
    platform_notes: 'SMS + IG. Personal, warm tone. "We miss you" angle.',
    prompt_hint: 'We miss you. Here\'s something special to come back. Personal and warm.'
  },
  {
    id: 'bundle_deal',
    name: 'Bundle Deal',
    emoji: '📦',
    objective: 'conversion',
    angle: 'benefit',
    description: 'Highlight value by combining products or services',
    best_for: ['restaurant', 'cafe', 'other'],
    platform_notes: 'FB + IG. Lead with value/savings.',
    prompt_hint: 'More value for less. Smart buyer angle. Show what they get.'
  }
];

export const ANGLE_OPTIONS = [
  { id: 'benefit', label: 'Benefit-led', description: 'What the customer gains', emoji: '💎', color: 'blue' },
  { id: 'scarcity', label: 'Scarcity-led', description: 'Limited time or quantity', emoji: '⚡', color: 'amber' },
  { id: 'story', label: 'Story / Social Proof', description: 'Narrative and credibility', emoji: '💬', color: 'purple' }
];