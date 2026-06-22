const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase र OneSignal को सेटिंग्स
const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com";
const POSTBACK_SECRET_KEY = "e4574240c62e6c2db436ca744c949e";
const ONESIGNAL_APP_ID = "0835cef0-d80e-41c7-929c-303b1c6f5276"; 
const ONESIGNAL_API_KEY = "os_v2_app_ba2454gybza4peu4ga5ry32sozp5o4bkemxe4z4aptm56gw3fq5ml5d3duharoglu7z7yt3p3rondm7tj4eewjkuzqnzn5tvsxqodry"; 

// OneSignal Notification पठाउने फंक्शन
async function sendOneSignalNotification(userId, title, message) {
    try {
        // OneSignal ले कतिपय अवस्थामा target_channel नतोक्दा वा पुराना API मा target_channel को समस्या दिने हुनाले safe side को लागि target_channel: "push" थप्न सकिन्छ, तर मुख्य संरचना यही हो
        await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: ONESIGNAL_APP_ID,
            headings: { "en": title },
            contents: { "en": message },
            properties: { target_channel: "push" }, // Push notification सुनिश्चित गर्न
            include_aliases: { "external_id": [String(userId)] } // External ID सधैं String हुनुपर्छ
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

        // लाइभ अफरवालको रीवार्ड फ्लोट वा स्ट्रिङ हुन सक्ने हुनाले सुरक्षित रूपमा ट्रंकेट गर्ने
        const rewardTruncated = Math.trunc(Number(reward));
        if (isNaN(rewardTruncated)) {
            return res.status(400).send("Invalid reward format");
        }

        const template = `${POSTBACK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        const expectedSignature = crypto.createHmac('sha256', POSTBACK_SECRET_KEY).update(template).digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            return res.status(403).send("Invalid signature");
        }

        // ट्रान्जेक्सन डुप्लिकेट चेक
        const checkTx = await axios.get(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`);
        if (checkTx.data) return res.status(200).send("Duplicate");

        // युजर डाटा तान्ने
        const userRes = await axios.get(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = userRes.data;

        if (!userData) return res.status(404).send("User not found");

        // पुराना ब्यालेन्सलाई सुरक्षित रूपमा Number मा ढाल्ने (undefined वा स्ट्रिङ भए पनि ० बनाउने)
        const currentBalance = Number(userData.balance || 0);
        
        // नयाँ ब्यालेन्स हिसाब गर्दा ट्रंकेट गरिएको रीवार्ड नै जोड्ने ताकी सिग्नेचर र थपिने कोइन सधैं समान होस्
        const newBalance = currentBalance + rewardTruncated;

        // कोइन र ब्यालेन्स अपडेट (नम्बर फिक्स गरेर पठाउने)
        await axios.patch(`${FIREBASE_DB_URL}/users/${user_id}.json`, { 
            balance: newBalance, 
            coins: newBalance 
        });

        // हिस्टोरी सेभ
        await axios.post(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            coins: rewardTruncated,
            offer_name: offer_name || "Unknown Game",
            task_name: task_name || "Offerwall Task",
            transaction_id,
            timestamp: Date.now()
        });

        // ट्रान्जेक्सन मार्क
        await axios.put(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`, { status: "used" });

        // वन-सिग्नल नोटिफिकेसन
        await sendOneSignalNotification(
            user_id,
            "Offerwall Completed! 🎁",
            `तपाईले ${offer_name || 'Offerwall'} खेलेर ${rewardTruncated} कोइन कमाउनु भयो!`
        );

        return res.status(200).send("OK");
    } catch (error) {
        console.error("Error:", error.message);
        return res.status(500).send("Server error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
