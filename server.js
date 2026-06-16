const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// तिमीले दिएको Postback Secret Key
const SECRET_KEY = "3c3d05d36dfdfd6539fb";

app.use(express.json());

// १. युजरलाई देखाउने होम पेज (Test Link Generate गर्न)
app.get('/', (req, res) => {
    res.send(`
        <h1>GrowDeck Playtime Integration Server is Running!</h1>
        <p>Use the <b>/postback</b> endpoint for your GrowDeck Dashboard.</p>
    `);
});

// २. GrowDeck Postback Endpoint (यसले रिवार्ड रिसिभ गर्छ)
app.get('/postback', (req, res) => {
    // GrowDeck ले पठाउने कोर प्यारामिटरहरू
    const { user_id, reward, transaction_id, signature } = req.query;

    // यदि आवश्यक प्यारामिटरहरू मिसिङ छन् भने
    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("Missing required parameters.");
    }

    // डकुमेन्ट अनुसार Signature रिक्रियट गर्ने तरिका (secretKey.user_id.reward.transaction_id)
    const template = `${SECRET_KEY}.${user_id}.${Math.trunc(Number(reward))}.${transaction_id}`;
    const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(template)
        .digest('hex');

    // ३. Signature म्याच गर्ने (Security Check)
    if (signature === expectedSignature) {
        console.log(`✅ Valid Request! Crediting ${reward} rewards to User ID: ${user_id}`);
        
        // ========================================================
        // यहाँ तिम्रो डाटाबेसको कोड हुन्छ (युजरको ब्यालेन्स बढाउने)
        // उदहारण: db.updateUserBalance(user_id, reward);
        // ========================================================

        // GrowDeck लाई सक्सेस रेस्पोन्स पठाउने
        return res.status(200).send("OK");
    } else {
        console.log("🚫 Invalid signature. Possible spoof attempt!");
        return res.status(401).send("Invalid Signature");
    }
});

// सर्भर अन गर्ने
app.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});
