import os
import tempfile
import speech_recognition as sr
from pydub import AudioSegment

def transcribe_audio(file_obj):
    """
    Takes an uploaded audio file object, converts it to WAV using pydub,
    and uses SpeechRecognition to extract text.
    Returns the transcribed text or an error message.
    """
    import subprocess
    
    # Check if ffmpeg is available
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        raise RuntimeError(
            "FFmpeg is not installed or not in the system PATH. "
            "This is required to process audio files like MP3 or M4A. "
            "Please install FFmpeg (e.g., 'winget install ffmpeg' on Windows) and restart the server."
        )

    # Create temporary files to hold the uploaded audio and the converted web format
    with tempfile.NamedTemporaryFile(delete=False, suffix=".upload") as temp_upload:
        for chunk in file_obj.chunks():
            temp_upload.write(chunk)
        temp_upload_path = temp_upload.name

    temp_wav_path = temp_upload_path + ".wav"
    
    transcribed_text = ""
    error_message = None

    try:
        # Load the audio file (pydub automatically detects format via ffmpeg)
        # We suppress errors and just try loading it
        audio = AudioSegment.from_file(temp_upload_path)
        
        # Export as standard WAV format (PCM 16-bit) suitable for SpeechRecognition
        audio.export(temp_wav_path, format="wav")
        
        # Initialize recognizer
        recognizer = sr.Recognizer()
        
        # Open the WAV file and transcribe
        with sr.AudioFile(temp_wav_path) as source:
            # You can adjust ambient noise calibration if needed, though usually fine without it
            audio_data = recognizer.record(source)
            
            # Use Google's free Web Speech API
            transcribed_text = recognizer.recognize_google(audio_data)

    except sr.UnknownValueError:
        error_message = "Speech not recognizable. Please ensure the audio contains clear speech."
    except sr.RequestError as e:
        error_message = f"Could not request results from Google Speech Recognition service; {e}"
    except Exception as e:
        error_message = f"Error processing audio file: {str(e)}"
    finally:
        # Cleanup temporary files
        if os.path.exists(temp_upload_path):
            try:
                os.remove(temp_upload_path)
            except:
                pass
        if os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except:
                pass

    if error_message:
        raise ValueError(error_message)

    return transcribed_text
