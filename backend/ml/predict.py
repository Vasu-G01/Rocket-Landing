from stable_baselines3 import PPO
from huggingface_hub import hf_hub_download
import gymnasium as gym

# Download pretrained model
model_path = hf_hub_download(
    repo_id="sb3/ppo-LunarLander-v2",
    filename="ppo-LunarLander-v2.zip"
)

# Load model
model = PPO.load(model_path)
print("Pretrained model loaded successfully!")

# Create environment
env = gym.make("LunarLander-v3", render_mode="human")

# Run 5 complete episodes
for episode in range(5):
    obs, info = env.reset()
    total_reward = 0

    while True:
        action, _states = model.predict(obs, deterministic=True)
        obs, reward, terminated, truncated, info = env.step(action)

        total_reward += reward

        if terminated or truncated:
            print(f"Episode {episode + 1}: Total Reward = {total_reward:.2f}")
            break

env.close()