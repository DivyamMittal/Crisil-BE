import Joi from "joi";
import dotenv from "dotenv";

dotenv.config();

const envSchema = Joi.object({
  PORT: Joi.number().default(4000),
  MONGO_URI: Joi.string().required().description("MongoDB connection URI"),
  JWT_SECRET: Joi.string().required().description("Secret key for JWT"),
  JWT_EXPIRES_IN: Joi.string().default("8h"),
  FRONTEND_URL: Joi.string().uri().default("http://localhost:5173"),
  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().required(),
  ADMIN_NAME: Joi.string().required(),
})
  .unknown()
  .required();

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const env = {
  port: envVars.PORT,
  mongoUri: envVars.MONGO_URI,
  jwtSecret: envVars.JWT_SECRET,
  jwtExpiresIn: envVars.JWT_EXPIRES_IN,
  frontendUrl: envVars.FRONTEND_URL,
  adminEmail: envVars.ADMIN_EMAIL,
  adminPassword: envVars.ADMIN_PASSWORD,
  adminName: envVars.ADMIN_NAME,
};
