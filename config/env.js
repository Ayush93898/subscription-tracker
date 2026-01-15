import { config } from "dotenv";
config({ path: `.env.${process.env.NODE_ENV || "development"}.local` }); // puts all values into process.env
export const { PORT, NODE_ENV, DB_URI, JWT_SECRET, JWT_EXPIRES, ARCJET_KEY, ARCJET_ENV } = process.env; // this line takes process.env.PORT

// above line code same as 
// const PORT = process.env.PORT;
// export { PORT };


// | NODE_ENV    | File loaded              |
// | ----------- | ------------------------ |
// | development | `.env.development.local` |
// | production  | `.env.production.local`  |
// | not set     | `.env.development.local` |
