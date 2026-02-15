import { setServers } from 'node:dns/promises';
setServers(['1.1.1.1', '8.8.8.8']);

import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

/**
 * CONFIGURATION INSTRUCTIONS:
 * 1. Go to Netlify Dashboard > Site Settings > Build & Deploy > Environment
 * 2. Add a variable: MONGODB_URI
 * 3. Value: mongodb+srv://mahian:<YOUR_PASSWORD>@wallet.kqa5yvr.mongodb.net/?appName=Wallet
 * (Replace <YOUR_PASSWORD> with your actual MongoDB password)
 */

const uri = process.env.MONGODB_URI || "";
let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  
  if (!uri || uri.includes('<db_password>') || uri.includes('<YOUR_PASSWORD>')) {
    throw new Error("MONGODB_URI is not configured correctly. Please set your password in the Netlify environment variables.");
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  } as any);

  await client.connect();
  cachedClient = client;
  return client;
}

export const handler: Handler = async (event) => {
  try {
    const client = await getClient();
    const db = client.db("glass_wallet");
    const collection = db.collection("user_data");
    const DOC_ID = "main_wallet_state";

    if (event.httpMethod === 'GET') {
      const data = await collection.findOne({ _id: DOC_ID as any });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || null),
      };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || "{}");
      // Remove _id from payload if it exists to prevent immutable field errors
      const { _id, ...updateData } = payload;
      
      await collection.updateOne(
        { _id: DOC_ID as any },
        { 
          $set: { 
            ...updateData, 
            lastSync: new Date().toISOString() 
          } 
        },
        { upsert: true }
      );
      
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Success" }),
      };
    }

    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  } catch (error: any) {
    console.error("Function Error:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: error.message || "Database connection failed",
        hint: "Check your Netlify environment variables for MONGODB_URI"
      }),
    };
  }
};
