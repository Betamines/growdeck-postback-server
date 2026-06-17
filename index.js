const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase र OneSignal को सेटिंग्स
const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com";
const POSTBACK_SECRET_KEY = "e4574240c62e6c2db436ca744c949e";
const ONESIGNAL_APP_ID = "0835cef0-d80e-41c7-929c-303b1c6f5276"; // 👉 यहाँ राख्नुहोस्
const ONESIGNAL_API_KEY = "os_v2_app_ba2454gybza4peu4ga5ry32sozp5o4bkemxe4z4aptm56gw3fq5ml5d3duharoglu7z7yt3p3rondm7tj4eewjkuzqnzn5tvsxqodry"; // 👉 यहाँ राख्नुहोस्

// OneSignal Notification पठाउने फंक्शन
async function sendOneSignalNotification(userId, title, message) {
    try {
        await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: ONESIGNAL_APP_ID,
            headings: { "en": title },
            contents: { "en": message },
            include_aliases: { "external_id": [userId] } // युजरको UID अनुसार पठाउने
        }, {
            headers: {
                "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        console.log(`Notification sent to ${userId}`);
    } catch (error) {
        console.error("OneSignal Error:", error.response?.data || error.message);
    }
}

app.get('/postback', async (req, res) => {
    try {
        const { user_id, reward, transaction_id, signature, offer_name, task_name } = req.query;

        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("Missing required parameters");
        }

        const rewardTruncated = Math.trunc(Number(reward));
        const template = `${POSTBACK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        const expectedSignature = crypto.createHmac('sha256', POSTBACK_SECRET_KEY).update(template).digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            return res.status(403).send("Invalid signature");
        }

        const checkTx = await axios.get(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`);
        if (checkTx.data) return res.status(200).send("Duplicate");

        const userRes = await axios.get(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = userRes.data;

        if (!userData) return res.status(404).send("User not found");

        const newBalance = Number(userData.balance || 0) + Number(reward);

        // कोइन अपडेट
        await axios.patch(`${FIREBASE_DB_URL}/users/${user_id}.json`, { balance: newBalance, coins: newBalance });

        // हिस्टोरी सेभ
        await axios.post(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            coins: Number(reward),
            offer_name: offer_name || "Unknown Game",
            task_name: task_name || "Offerwall Task",
            transaction_id,
            timestamp: Date.now()
        });

        // ट्रान्जेक्सन मार्क
        await axios.put(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`, { status: "used" });

        // 🔥 वन-सिग्नल नोटिफिकेसन पठाउने
        await sendOneSignalNotification(
            user_id,
            "Offerwall Completed! 🎁",
            `तपाईले ${offer_name} खेलेर ${reward} कोइन कमाउनु भयो!`
        );

        return res.status(200).send("OK");
    } catch (error) {
        console.error("Error:", error.message);
        return res.status(500).send("Server error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
