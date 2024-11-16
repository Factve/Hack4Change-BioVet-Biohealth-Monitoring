require("dotenv").config();
const express = require("express");
const multer = require("multer");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const MODEL_NAME = "gemini-1.5-pro";
const API_KEY = process.env.API_KEY;

app.set("view engine", "ejs");
app.set("views", `${__dirname}/views`);
app.use(express.static(`${__dirname}/public`));

app.get("/", (req, res) => {
  res.render("index", { bioInfo: null });
});

app.post("/upload", upload.single("image"), async (req, res) => {
  const imageBuffer = req.file ? req.file.buffer : null;
  if (!imageBuffer) {
    return res.status(400).json({ error: "No image file provided" });
  }

  try {
    const bioInfo = await getbioInfo(imageBuffer);
    console.log("Server response:", bioInfo);

    if (bioInfo.error) {
      return res.status(400).json({ error: bioInfo.error });
    } else {
      bioInfo.imageBase64 = imageBuffer.toString("base64");
      return res.json({ bioInfo });
    }
  } catch (error) {
    console.error("Error:", error);
    if (error.name === "GoogleGenerativeAIFetchError") {
      return res.status(500).json({
        error: "A server error occurred at Google's API. Please retry later.",
      });
    } else {
      return res.status(500).json({
        error: "An unexpected error occurred on the server.",
      });
    }
  }
});

const getbioInfo = async (imageBuffer) => {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.9,
    topK: 32,
    topP: 0.95,
    maxOutputTokens: 1024,
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

const parts = [
  {
    text: `Analyze the flower's petal and sepal measurements to classify the type of flower.
    Respond in the following JSON format:
    {
      "flower": {
        "name": "type the flower's name here (e.g., Setosa, Versicolor, Virginica)",
        "description": "provide a brief description of the flower, including key characteristics, in 200 words or less."
      }
    }

    If the measurements do not correspond to a known flower, respond in this format:
    {
      "error": "The measurements do not match any known flower."
    }`,
  },
  {
    inlineData: {
      mimeType: "application/json",
      data: JSON.stringify({
        sepalLength: 5.1,  // example value
        sepalWidth: 3.5,   // example value
        petalLength: 1.4,  // example value
        petalWidth: 0.2,   // example value
      }),
    },
  },
];




  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
      safetySettings,
    });

    const responseText = result.response.text();
    return JSON.parse(responseText.replace(/```json|```/g, ""));
  } catch (error) {
    console.error("Error while parsing the API response:", error);
    throw error;
  }
};

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
