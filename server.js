const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const FIREBASE_BASE_URL = "https://cash-jitau-default-rtdb.firebaseio.com";

app.use(express.json());

app.get('/', (req, res) => {
    res.send("<h1>Server Connected</h1>");
});

app.get('/postback', async (req, res) => {
    const { user_id, reward } = req.query;

    if (!user_id || !reward) {
        return res.status(400).send("Missing parameters");
    }

    try {
        const rewardAmount = Math.trunc(Number(reward));
        
        // १. पहिले सिधै त्यो युजरको डाटा भएको पुरै लिङ्क तान्ने
        const userUrl = `${FIREBASE_BASE_URL}/users/${user_id}.json`;
        const response = await axios.get(userUrl);
        
        // यदि युजर भेटियो भने उसको हालको ब्यालेन्स लिने, नत्र ० मान्ने
        let currentBalance = 0;
        if (response.data && response.data.balance) {
            currentBalance = Number(response.data.balance);
        }

        const newBalance = currentBalance + rewardAmount;

        // २. 🎯 फायरबेस फिक्स ट्रिक: सिधै /users/{user_id}.json मा PATCH हान्ने (यसलाई फायरबेसले रोक्दैन)
        await axios.patch(userUrl, {
            balance: newBalance
        });

        console.log(`✅ SUCCESS: Added ${rewardAmount} to User: ${user_id}. New Balance: ${newBalance}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("❌ REAL FIREBASE ERROR:", error.message);
        // अब गल्ती नलुकाउने, यदि फायरबेसले ब्लक गरेमा सिधै ५०० एरर फाल्ने ताकि तिमीलाई थाहा होस्
        return res.status(500).send(`Firebase Failed: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server live on port ${PORT}`);
});
