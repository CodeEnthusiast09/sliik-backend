export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY,
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
  },

  payment: {
    successUrl: process.env.PAYMENT_SUCCESS_URL,
    cancelUrl: process.env.PAYMENT_CANCEL_URL,
  },

  payout: {
    platformCommissionPercent: parseInt(
      process.env.PLATFORM_COMMISSION_PERCENT ?? '10',
      10,
    ),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  uploads: {
    maxSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '5', 10),
  },

  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT ?? '465', 10),
    secure: process.env.MAIL_SECURE !== 'false',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    fromName: process.env.MAIL_FROM_NAME ?? 'Sliik',
    fromAddress: process.env.MAIL_FROM_ADDRESS,
  },

  passwordReset: {
    codeExpiryMinutes: parseInt(
      process.env.PASSWORD_RESET_CODE_EXPIRY_MINUTES ?? '10',
      10,
    ),
    maxAttempts: parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS ?? '5', 10),
    resendCooldownSeconds: parseInt(
      process.env.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS ?? '60',
      10,
    ),
  },

  throttle: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '900', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '3', 10),
  },
});
