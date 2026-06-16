const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// १. हजुरले उपलब्ध गराउनुभएको नयाँ Secret Key र Firebase URL
const GROWDECK_SECRET_KEY = "3c3d05d36dfdfd6539fb"; 
const FIREBASE_DATABASE_URL = "https://cash-jitau-default-rtdb.firebaseio.com/";

// २. GrowDeck Playtime URL जेनेरेट गर्ने लिङ्क
app.get('/get-wall-url', (req, res) => {
    const userId = req.query.user_id || "guest_123";
    const appId = req.query.app_id || "YOUR_APP_ID"; 

    // जुनसुकै एउटा र्‍यान्डम डिभाइस आईडी जेनेरेट गर्ने
    const randomDeviceId = Math.random().toString(36).substring(2, 15);

    // Playtime URL Format (नयाँ Secret Key प्रयोग गरिएको)
    const wallUrl = `https://websdk.growdeck.io/?app-id=${appId}&secret-key=${GROWDECK_SECRET_KEY}&external-id=${userId}&device-id=${randomDeviceId}`;

    res.json({ url: wallUrl });
});

// ३. GrowDeck ले डेटा पठाउने मुख्य Postback URL (सत्यापन र एरर ह्यान्डलिंग सहित)
app.get('/postback', (req, res) => {
    try {
        const { user_id, reward, transaction_id, signature } = req.query;

        // अनिवार्य पारामिटरहरू आएका छन् कि छैनन् जाँच गर्ने
        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("अनिवार्य विवरणहरू पुगेनन्।");
        }

        // Signature रिक्रिएट गर्ने संरचना: secretKey.user_id.reward.transaction_id
        const rewardTruncated = Math.trunc(Number(reward));
        const template = `${GROWDECK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        
        const expectedSignature = crypto
            .createHmac('sha256', GROWDECK_SECRET_KEY)
            .update(template)
            .digest('hex');

        // दुवै Signature म्याच गराउने
        if (signature === expectedSignature) {
            console.log(`सफल रिक्वेस्ट! प्रयोगकर्ता ${user_id} ले ${reward} पुरस्कार पाए।`);
            
            // यहाँ हजुरले 'FIREBASE_DATABASE_URL' प्रयोग गरेर युजरको डाटाबेस अपडेट गर्न सक्नुहुन्छ।
            
            return res.status(200).send("OK"); 
        } else {
            console.log("गलत सिग्नेचर! अवैध रिक्वेस्ट।");
            return res.status(403).send("नक्कली वा अवैध रिक्वेस्ट।");
        }
    } catch (error) {
        // कुनै पनि अप्रत्याशित एरर आएमा सर्भर क्र्यास हुनबाट जोगाउने सुरक्षित तरिका
        console.error("सर्भरमा समस्या आयो:", error.message);
        return res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, () => {
    console.log(`सर्भर पोर्ट ${PORT} मा सफलतापूर्वक चलिरहेको छ।`);
});
