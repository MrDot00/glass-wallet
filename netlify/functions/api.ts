import { setServers } from 'node:dns/promises';
// Set DNS servers to prevent connection timeout issues in some environments
try {
  setServers(['1.1.1.1', '8.8.8.8']);
} catch (e) {
  console.log("DNS setServers not supported in this environment");
}

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI || "";
let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  
  if (!uri || uri.includes('<YOUR_PASSWORD>')) {
    throw new Error("MONGODB_URI is not configured correctly in Netlify.");
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

// Fixed the (event) error by adding the correct types from @netlify/functions
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  try {
    const client = await getClient();
    const db = client.db("glass_wallet");
    const collection = db.collection("user_data");
    const DOC_ID = "main_wallet_state";

    if (event.httpMethod === 'GET') {
      const data = await collection.findOne({ _id: DOC_ID as any });
      return {
        statusCode: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        },
        body: JSON.stringify(data || null),
      };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || "{}");
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
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
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
      }),
    };
  }
};