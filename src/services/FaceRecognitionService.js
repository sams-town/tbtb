import path from 'path';
import fs from 'fs';
import * as canvas from 'canvas';
import * as faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js';

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

class FaceRecognitionService {
    userDescriptorsCache = {};

    async loadModels() {
        if (modelsLoaded) return;
        
        await faceapi.tf.setBackend('wasm');
        await faceapi.tf.ready();

        const MODEL_URL = path.join(process.cwd(), 'node_modules', '@vladmandic/face-api', 'model');
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_URL);
        modelsLoaded = true;
    }

    async getFaceDescriptor(imagePath) {
        await this.loadModels();
        if (!fs.existsSync(imagePath)) return null;
        try {
            const img = await canvas.loadImage(imagePath);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            return detection?.descriptor;
        } catch (e) {
            console.error("Error getFaceDescriptor for", imagePath, e.message);
            return null;
        }
    }

    async findMatchingUser(incomingPath, users) {
        await this.loadModels();
        const incomingDesc = await this.getFaceDescriptor(incomingPath);
        if (!incomingDesc) {
            return { user: null, error: "Tidak ditemukan wajah pada foto absensi yang di-upload." };
        }

        let bestMatch = null;
        let bestDistance = 0.55; // threshold for euclidean distance

        for (const user of users) {
            if (!user.foto_face_recognition) continue;

            const userIdStr = user.id.toString();
            let userDesc = this.userDescriptorsCache[userIdStr];
            
            if (!userDesc) {
                let referencePath = "";
                try {
                    const url = new URL(user.foto_face_recognition);
                    referencePath = path.join(process.cwd(), "public", url.pathname);
                } catch (e) {
                    referencePath = path.join(process.cwd(), "public", user.foto_face_recognition);
                }
                
                userDesc = await this.getFaceDescriptor(referencePath);
                if (userDesc) {
                    this.userDescriptorsCache[userIdStr] = userDesc;
                }
            }

            if (userDesc) {
                const distance = faceapi.euclideanDistance(incomingDesc, userDesc);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = user;
                }
            }
        }

        if (bestMatch) {
            return { user: bestMatch, distance: bestDistance };
        }
        return { user: null, error: "Wajah tidak cocok dengan data referensi karyawan mana pun." };
    }

    // fallback kept for compatibility
    async compareFaces(referencePath, incomingPath) {
        try {
            const desc1 = await this.getFaceDescriptor(referencePath);
            if (!desc1) return { isMatch: false, error: "Tidak ditemukan wajah referensi" };
            const desc2 = await this.getFaceDescriptor(incomingPath);
            if (!desc2) return { isMatch: false, error: "Tidak ditemukan wajah pada input" };

            const distance = faceapi.euclideanDistance(desc1, desc2);
            return { isMatch: distance < 0.55, distance };
        } catch (error) {
            return { isMatch: false, error: error.message };
        }
    }
}

export default new FaceRecognitionService();
