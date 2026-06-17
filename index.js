const express = require('express');
const crypto = require('crypto');
const axios = require('axios'); // Fetch भन्दा axios सजिलो र भरपर्दो हुन्छ

const app = express();
const PORT = process.env.PORT || 3000;

// आफ्नो सही Firebase URL र Key यहाँ पक्का गर्नुहोस्
const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com";
const POSTBACK_SECRET_KEY = "e4574240c62e6c2db436ca744c949e";

app.get('/postback', async (req, res) => {
    try {
        const { 
            user_id, 
            reward, 
            transaction_id, 
            signature,
            offer_name,
            task_name
        } = req.query;

        // १. डाटा चेक
        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("Missing required parameters");
        }

        // २. सिग्नेचर भेरिफाई (Security)
        const rewardTruncated = Math.trunc(Number(reward));
        const template = `${POSTBACK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        
        const expectedSignature = crypto
            .createHmac('sha256', POSTBACK_SECRET_KEY)
            .update(template)
            .digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            console.log("Security Alert: Invalid signature");
            return res.status(403).send("Invalid signature");
        }

        // ३. Duplicate Transaction रोक्ने
        const checkTx = await axios.get(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`);
        if (checkTx.data) {
            console.log("Duplicate request ignored");
            return res.status(200).send("Duplicate");
        }

        // ४. युजर डाटा फेच
        const userRes = await axios.get(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = userRes.data;

        if (!userData) {
            return res.status(404).send("User not found");
        }

        const currentBalance = Number(userData.balance || userData.coins || 0);
        const newBalance = currentBalance + Number(reward);

        // ५. कोइन र ब्यालेन्स अपडेट
        await axios.patch(`${FIREBASE_DB_URL}/users/${user_id}.json`, { 
            balance: newBalance,
            coins: newBalance
        });

        // ६. हिस्टोरी सेभ (एपमा देखाउनको लागि)
        const historyData = {
            coins: Number(reward),
            offer_name: offer_name || "Unknown Game",
            task_name: task_name || "Offerwall Task",
            transaction_id: transaction_id,
            timestamp: Date.now()
        };

        await axios.post(`${FIREBASE_DB_URL}/history/${user_id}.json`, historyData);

        // ७. ट्रान्जेक्सन मार्क गर्ने
        await axios.put(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`, { status: "used" });

        console.log(`Success: User ${user_id} earned ${reward} coins`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("Error processing postback:", error.message);
        return res.status(500).send("Server error");
    }
});

app.listen(PORT, () => {
    console.log(`Postback server is running on port ${PORT}`);
});
