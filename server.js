const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

const SECRET_KEY = "3c3d05d36dfdfd6539fb";
const FIREBASE_BASE_URL = "https://cash-jitau-default-rtdb.firebaseio.com";

app.use(express.json());

app.get('/', (req, res) => {
    res.send("<h1>Server Connected Properly</h1>");
});

app.get('/postback', async (req, res) => {
    const { user_id, reward, transaction_id, signature } = req.query;

    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("Missing parameters");
    }

    // १. सिग्नेचर चेक गर्ने
    const template = `${SECRET_KEY}.${user_id}.${Math.trunc(Number(reward))}.${transaction_id}`;
    const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(template)
        .digest('hex');

    if (signature !== expectedSignature) {
        return res.status(401).send("Invalid Signature");
    }

    // २. फायरबेसको सही लोकेसनमा ब्यालेन्स अपडेट गर्ने
    try {
        const rewardAmount = Math.trunc(Number(reward));
        
        // 🎯 ध्यान देऊ: /users/{user_id}/balance.json मा सिधै हिट गर्ने
        const userUrl = `${FIREBASE_BASE_URL}/users/${user_id}/balance.json`;

        // पहिलेको ब्यालेन्स कति छ तान्ने
        const response = await axios.get(userUrl);
        const currentBalance = response.data !== null ? Number(response.data) : 0;
        
        // नयाँ ब्यालेन्स हिसाब गरेर PUT गर्ने
        const newBalance = currentBalance + rewardAmount;
        await axios.put(userUrl, newBalance);

        return res.status(200).send("OK");

    } catch (error) {
        console.error("Firebase Error:", error.message);
        return res.status(500).send("Database Error");
    }
});

app.listen(PORT, () => {
    console.log(`Server live on port ${PORT}`);
});
