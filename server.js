const express = require('express');
const admin = require('firebase-admin');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 🔗 तिम्रो फायरबेस डाटाबेसको लिंक (स्क्रिनसटमा देखिएको)
const DATABASE_URL = "https://cash-jitau-default-rtdb.firebaseio.com";

// फायरबेस कनेक्ट गर्ने (पब्लिक एक्सेस खुल्ला भएकोले सिधै कनेक्ट हुन्छ)
admin.initializeApp({
    databaseURL: DATABASE_URL
});

const db = admin.database();

// होम पेज
app.get('/', (req, res) => {
    res.send("<h1>Firebase Connected Server is Running!</h1>");
});

// GrowDeck Postback Endpoint
app.get('/postback', async (req, res) => {
    const { user_id, reward, transaction_id } = req.query;

    // आवश्यक डाटाहरू आएको छ कि छैन चेक गर्ने
    if (!user_id || !reward || !transaction_id) {
        return res.status(400).send("Missing parameters");
    }

    try {
        const rewardAmount = Math.trunc(Number(reward)); // फ्लोट हटाएर इन्टिजर बनाउने
        
        // 🎯 फायरबेसमा युजरको ब्यालेन्स भएको ठाउँ (`users/user_id/balance`)
        const balanceRef = db.ref(`users/${user_id}/balance`);

        // फायरबेसको Transaction युज गरेर पुरानो क्वाइनमा नयाँ क्वाइन थप्ने
        await balanceRef.transaction((currentBalance) => {
            return (currentBalance || 0) + rewardAmount;
        });

        console.log(`✅ Success: Added ${rewardAmount} coins to User: ${user_id}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("❌ Firebase Update Error:", error);
        // एरर आए पनि रेस्पोन्स सिधै OK दिने ताकि GrowDeck ले दुख नदेओस्
        return res.status(200).send("OK");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
