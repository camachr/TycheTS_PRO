#!/bin/bash

# setNewClone.sh
# Uso: ./setNewClone.sh <NUEVA_DIRECCION_CLON>

NEW_CLONE_ADDRESS=$1
ENV_FILE=".env"

if [[ -z "$NEW_CLONE_ADDRESS" ]]; then
  echo "❌ Dirección del clon no proporcionada."
  echo "Uso: ./setNewClone.sh 0xABC123..."
  exit 1
fi

echo "🔁 Actualizando $ENV_FILE..."

# Reemplaza o agrega MAINNET_CLONE_CONTRACT
if grep -q "^MAINNET_CLONE_CONTRACT=" "$ENV_FILE"; then
  sed -i "s/^MAINNET_CLONE_CONTRACT=.*/MAINNET_CLONE_CONTRACT=$NEW_CLONE_ADDRESS/" "$ENV_FILE"
else
  echo "MAINNET_CLONE_CONTRACT=$NEW_CLONE_ADDRESS" >> "$ENV_FILE"
fi

# Reemplaza o agrega MAINNET_FLASHLOAN_CONTRACT
if grep -q "^MAINNET_FLASHLOAN_CONTRACT=" "$ENV_FILE"; then
  sed -i "s/^MAINNET_FLASHLOAN_CONTRACT=.*/MAINNET_FLASHLOAN_CONTRACT=$NEW_CLONE_ADDRESS/" "$ENV_FILE"
else
  echo "MAINNET_FLASHLOAN_CONTRACT=$NEW_CLONE_ADDRESS" >> "$ENV_FILE"
fi

echo "✅ Variables actualizadas en $ENV_FILE:"
echo "MAINNET_CLONE_CONTRACT=$NEW_CLONE_ADDRESS"
echo "MAINNET_FLASHLOAN_CONTRACT=$NEW_CLONE_ADDRESS"
