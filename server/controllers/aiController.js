import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import path from "path";
import OpenAI from "openai";
import sql from '../configs/db.js'
import {clerkClient} from '@clerk/express';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';


const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});


export const generateArticle = async (req, res) =>{
    try{
        const {userId} = req.auth();
        const {prompt, length} = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if(plan != 'premium' && free_usage >= 10){
            return res.json({success:false, message: "Limit reached. Upgrade to continue."})
        }

        const response = await AI.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
        {
            role: "user",
            content: prompt,
        },
        ],
        temperature: 0.7, 
        max_tokens: length*3,

        });


        const content = response.choices[0].message.content

        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, ${prompt}, ${content}, 'article')`;

        if(plan !== 'premium'){
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: free_usage + 1
                }

            })
        }

        res.json({success:true, content})

    }catch(error){
        console.log(error.message)
        res.json({success:false, message: error.message})
    }
}

export const generateBlogTitle = async (req, res) =>{
    try{
        const {userId} = req.auth();
        const {prompt} = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if(plan != 'premium' && free_usage >= 10){
            return res.json({success:false, message: "Limit reached. Upgrade to continue."})
        }

        const response = await AI.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
        {
            role: "user",
            content: prompt,
        },
    ],
    temperature: 0.7, 
    max_tokens: 9000,

    });


    const content = response.choices[0].message.content;



    await sql` INSERT INTO creations (user_id, prompt, content, type) 
    VALUES (${userId}, ${prompt}, ${content}, 'blog-title')`;

    if(plan !== 'premium'){
        await clerkClient.users.updateUserMetadata(userId, {
            privateMetadata: {
                free_usage: free_usage + 1
            }

        })
    }

    res.json({success:true, content})

    }catch(error){
        console.log(error.message)
        res.json({success:false, message: error.message})
    }
}

export const generateImage = async (req, res) =>{
    try{
        const {userId} = req.auth();
        const {prompt,publish} = req.body;
        const plan = req.plan;
        // const free_usage = req.free_usage;

        if(plan != 'premium'){
            return res.json({success:false, message: "This feature is only available for premium subscriptions."})
        }

        const formData = new FormData()
        formData.append('prompt', prompt)
        const {data} = await axios.post("https://clipdrop-api.co/text-to-image/v1", formData, {
            headers: {'x-api-key': process.env.CLIPDROP_API_KEY,},
            responseType: "arraybuffer",
        })

        const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;

        const {secure_url} = await cloudinary.uploader.upload(base64Image)



        await sql` INSERT INTO creations (user_id, prompt, content, type, publish) 
        VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`;


        res.json({success:true, content: secure_url})

    }catch(error){
        console.log(error.message)
        res.json({success:false, message: error.message})
    }
}

export const removeImageBackground = async (req, res) =>{
    try{
        const {userId} = req.auth();
        const image = req.file;
        const plan = req.plan;
        

        if(plan != 'premium'){
            return res.json({success:false, message: "This feature is only available for premium subscriptions."})
        }

        

        const {secure_url} = await cloudinary.uploader.upload(image.path, {
            transformation: [
                {
                    effect: 'background_removal',
                    background_removal: 'remove_the_background'
                }
            ]
        })

        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, 'Remove Background from image', ${secure_url}, 'image')`;


        res.json({success:true, content: secure_url})

    }catch(error){
        console.log(error.message)
        res.json({success:false, message: error.message})
    }
}


export const removeImageObject = async (req, res) =>{
    try{
        const {userId} = req.auth();
        const {object} = req.body;
        const image = req.file;
        const plan = req.plan;
        

        if(plan != 'premium'){
            return res.json({success:false, message: "This feature is only available for premium subscriptions."})
        }

        const {public_id} = await cloudinary.uploader.upload(image.path)

        const imageUrl = cloudinary.url(public_id, {
            transformation: [{effect: `gen_remove:${object}`}],
            resource_type: 'image'
        })


        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')`;


        res.json({success:true, content: imageUrl})

    }catch(error){
        console.log(error.message)
        res.json({success:false, message: error.message})
    }
}





export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;
    const plan = req.plan;

    // 1️⃣ Premium check
    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions."
      });
    }

    // 2️⃣ File check
    if (!resume) {
      return res.json({
        success: false,
        message: "No resume file uploaded"
      });
    }

    // 3️⃣ Size check (optional)
    if (resume.size > 5 * 1024 * 1024) {
      return res.json({
        success: false,
        message: "Resume file size exceeds 5MB"
      });
    }

    // 4️⃣ Read PDF from disk
    const pdfPath = path.resolve(resume.path);
    const pdfBuffer = fs.readFileSync(pdfPath);

    // 5️⃣ Parse PDF
    const pdfData = await pdfParse(pdfBuffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      return res.json({
        success: false,
        message: "Unable to extract text from PDF"
      });
    }

    // 6️⃣ AI Prompt
    const prompt = `
        Analyze the resume below and provide:

        1. ATS Score (out of 100)
        2. Strengths
        3. Weaknesses
        4. Areas of Improvement
        5. Final Recommendations

        Use clear Markdown formatting.

        Resume Content:
        ${pdfData.text}
    `;

    const response = await AI.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 10000
    });

    const content = response?.choices?.[0]?.message?.content;

    if (!content || content.trim().length === 0) {
        return res.status(500).json({
        success: false,
        message: "AI failed to generate resume review. Please try again."
    });
    }

    await sql`
        INSERT INTO creations (user_id, prompt, content, type)
        VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
    `;

    res.json({ success: true, content });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
