from flask import Flask, jsonify, request
from flask_cors import CORS
from stable_baselines3 import PPO
from huggingface_hub import hf_hub_download
import numpy as np

app = Flask(__name__)
CORS(app)

# Load pretrained PPO model
print("Loading PPO LunarLander model...")

model_path = hf_hub_download(
    repo_id="sb3/ppo-LunarLander-v2",
    filename="ppo-LunarLander-v2.zip"
)

model = PPO.load(model_path)

print("PPO model loaded successfully!")


@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        if not data or "observation" not in data:
            return jsonify({"error": "Observation is required"}), 400

        observation = np.asarray(
            data["observation"],
            dtype=np.float32
        )

        if observation.shape != (8,):
            return jsonify({
                "error": "Observation must contain exactly 8 values"
            }), 400

        if not np.all(np.isfinite(observation)):
            return jsonify({
                "error": "Observation contains invalid numbers"
            }), 400

        action, _ = model.predict(
            observation,
            deterministic=True
        )

        return jsonify({
            "action": int(action)
        })

    except Exception as error:
        app.logger.exception("Prediction failed")
        return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )