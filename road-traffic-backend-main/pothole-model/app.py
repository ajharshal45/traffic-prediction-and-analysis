import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.mobilenet import preprocess_input
from PIL import Image
import tensorflow as tf

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
PORT = 3003
MODEL_PATH = 'pothole_mobnet_base.h5' 

# --- LOAD MODEL WITH COMPATIBILITY FIX ---
print("Loading Keras model...")

# FIX: Create a custom DepthwiseConv2D that ignores the 'groups' argument
# This fixes the version mismatch error without needing to downgrade TensorFlow
try:
    from keras.layers import DepthwiseConv2D
    class FixedDepthwiseConv2D(DepthwiseConv2D):
        def __init__(self, **kwargs):
            # Pop 'groups' if it exists to prevent the error
            kwargs.pop('groups', None)
            super().__init__(**kwargs)

    # Load the model using the custom object scope
    with tf.keras.utils.custom_object_scope({'DepthwiseConv2D': FixedDepthwiseConv2D}):
        model = load_model(MODEL_PATH)
    
    print(f"Model '{MODEL_PATH}' loaded successfully (with compatibility fix)!")

except Exception as e:
    print(f"Error loading model: {e}")
    print("Attempting standard load...")
    try:
        model = load_model(MODEL_PATH)
        print(f"Model '{MODEL_PATH}' loaded successfully (standard load)!")
    except Exception as e2:
        print(f"Fatal Error: {e2}")
        model = None

def prepare_image(img_path):
    """
    Preprocesses the image to fit MobileNet requirements (224x224).
    """
    try:
        # Use PIL directly to match your training logic
        img = Image.open(img_path).convert("RGB")
        img = img.resize((224, 224))
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        print(f"Error preparing image: {e}")
        return None

@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "running", "message": "Pothole Detection API is active."})

@app.route('/predict', methods=['POST'])
def predict():
    if not model:
        return jsonify({'error': 'Model not loaded'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        file_path = os.path.join('temp_upload.jpg')
        file.save(file_path)

        try:
            processed_img = prepare_image(file_path)
            if processed_img is None:
                return jsonify({'error': 'Failed to process image'}), 400

            # --- PREDICTION LOGIC ---
            preds = model.predict(processed_img)
            
            # Using your specific logic: > 0.5 is pothole
            prediction_value = float(preds[0][0] if len(preds[0]) == 1 else preds[0][1])
            class_name = 'pothole' if prediction_value > 0.5 else 'no-pothole'
            
            print(f"Prediction: {class_name} (Score: {prediction_value:.4f})")

            os.remove(file_path)

            return jsonify({
                'prediction': class_name, 
                'confidence': prediction_value
            })

        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            print(f"Prediction Error: {e}")
            return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=True)