import { setServers } from 'node:dns/promises';
try {
  setServers(['1.1.1.1', '8.8.8.8']);
} catch (e) {
  console.log("DNS setServers not supported");
}

import { Handler, HandlerEvent } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI || "";
let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  } as any);
  await client.connect();
  cachedClient = client;
  return client;
}

export const handler: Handler = async (event: HandlerEvent) => {
  try {
    const client = await getClient();
    const db = client.db("glass_wallet");
    const collection = db.collection("user_data");
    const DOC_ID = "main_wallet_state";

    if (event.httpMethod === 'GET') {
      const data = await collection.findOne({ _id: DOC_ID as any });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(data || null),
      };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || "{}");

      // NEW RESET LOGIC: If the app sends action: 'RESET', we wipe the arrays
      if (payload.action === 'RESET') {
        await collection.updateOne(
          { _id: DOC_ID as any },
          { 
            $set: { 
              transactions: [], 
              buckets: payload.buckets || [], // Keeps existing buckets or resets them
              lastSync: new Date().toISOString() 
            } 
          }
        );
        return { statusCode: 200, body: JSON.stringify({ message: "Data Reset Successfully" }) };
      }

      // Standard Update Logic
      const { _id, ...updateData } = payload;
      await collection.updateOne(
        { _id: DOC_ID as any },
        { $set: { ...updateData, lastSync: new Date().toISOString() } },
        { upsert: true }
      );
      return { statusCode: 200, body: JSON.stringify({ message: "Success" }) };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};