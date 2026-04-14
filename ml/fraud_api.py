"""
fraud_api.py — Flask REST API for Fraud Detection (v2)
"""
from flask import Flask, request, jsonify
import pickle, numpy as np, os

app = Flask(__name__)
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model', 'fraud_model.pkl')

try:
    with open(MODEL_PATH, 'rb') as f:
        data = pickle.load(f)
        model = data['model']
        FEATURES = data['features']
    print(f"✅ Model loaded from {MODEL_PATH}")
except FileNotFoundError:
    print("❌ Model not found! Run train_model.py first.")
    model = None; FEATURES = []

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    payload = request.get_json()
    if not payload:
        return jsonify({'error': 'No JSON body'}), 400
    try:
        vals = [float(payload.get(f, 0)) for f in FEATURES]
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid feature: {e}'}), 400

    X = np.array([vals])
    proba = model.predict_proba(X)[0]
    fraud_prob = float(proba[1])
    score = round(fraud_prob * 100, 2)
    is_fraud = score >= 60  # 60+ = flagged

    # Determine risk level
    if score >= 80: level = 'CRITICAL'
    elif score >= 60: level = 'HIGH'
    elif score >= 35: level = 'MEDIUM'
    else: level = 'LOW'

    return jsonify({
        'fraud_score': score,
        'fraud_probability': round(fraud_prob, 4),
        'is_fraud': is_fraud,
        'label': 'FRAUD' if is_fraud else 'LEGITIMATE',
        'risk_level': level
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model_loaded': model is not None})

if __name__ == '__main__':
    print("\n🤖 Fraud Detection ML API running on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
