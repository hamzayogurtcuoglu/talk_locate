import speech_recognition as sr
import requests
import json
from gtts import gTTS
from playsound import playsound
import os

API_KEY = "API_KEY"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"

def record_audio():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening...")
        try:
            audio = recognizer.listen(source, timeout=5)
            text = recognizer.recognize_google(audio, language="tr-TR")
            print(f"You said: {text}")
            return text
        except sr.UnknownValueError:
            print("I couldn't understand.")
            return None
        except sr.WaitTimeoutError:
            print("Timeout.")
            return None
        except Exception as e:
            print(f"Error: {str(e)}")
            return None

def send_to_gemini(prompt_text):
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_text}
                ]
            }
        ]
    }

    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(API_URL, headers=headers, data=json.dumps(payload))
    return response.json()

def speak(text):
    """gTTS ile metni MP3'e dönüştürür ve playsound ile çalar."""
    # Temporary audio file name
    filename = "temp_response.mp3"
    
    # creating gTTS object
    tts = gTTS(text=text, lang="tr")
    tts.save(filename)
    
    # Playing the converted file
    playsound(filename)
    
    # Removing the file
    os.remove(filename)

if __name__ == "__main__":
    user_text = record_audio()  # Convert speech to text
    if user_text:
        gemini_response = send_to_gemini(user_text)  # Send the text to Gemini API
        
        print("----- Gemini's Answer -----")
        print(json.dumps(gemini_response, indent=2, ensure_ascii=False))
        
        # Extract the first text from "candidates"
        try:
            candidates = gemini_response["candidates"]
            answer = candidates[0]["content"]["parts"][0]["text"]
            print("----- Gemini'nin Cevabı -----")
            print(answer)

            # Convert answer to speech (gTTS and playsound)
            speak(answer)

        except Exception as e:
            print(f"Error parsing answer: {str(e)}")
    else:
        print("No text captured.")
