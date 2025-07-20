#!/bin/bash
set -euo pipefail

# scripts/deployAllMainnet.sh

# --- Configuración inicial ---
echo "📦 Cargando y validando variables de entorno..."
source .env

# --- Validación de variables ---
validate_eth_address() {
    [[ "$1" =~ ^0x[a-fA-F0-9]{40}$ ]] || { echo "❌ $2 no es una dirección Ethereum válida: $1"; exit 1; }
}

# Variables obligatorias
REQUIRED_VARS=(
    "ETHEREUM_RPC_URL"
    "PRIVATE_KEY"
    "DEPLOYER_ADDRESS"
    "ETHERSCAN_API_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    [ -z "${!var:-}" ] && { echo "❌ Falta la variable de entorno: $var"; exit 1; }
done

validate_eth_address "$DEPLOYER_ADDRESS" "DEPLOYER_ADDRESS"

# --- Verificación de dependencias ---
command -v forge >/dev/null 2>&1 || { echo "❌ Error: forge no está instalado"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ Error: pnpm no está instalado"; exit 1; }

# --- Despliegue con Foundry ---
echo "🚀 Ejecutando script de despliegue con Foundry..."
output=$(forge script scripts/DeployImplementationAndFactory.sol:DeployImplementationAndFactory \
    --rpc-url "$ETHEREUM_RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --verify \
    --etherscan-api-key "$ETHERSCAN_API_KEY")

# --- Extracción de direcciones ---
echo "🔍 Extrayendo direcciones de contratos..."
MAINNET_IMPLEMENTATION_CONTRACT=$(echo "$output" | grep "Implementation deployed at:" | awk '{print $NF}')
MAINNET_FACTORY_CONTRACT=$(echo "$output" | grep "Factory deployed at:" | awk '{print $NF}')

[ -z "$MAINNET_IMPLEMENTATION_CONTRACT" ] && { echo "❌ Error al extraer dirección de implementación"; exit 1; }
[ -z "$MAINNET_FACTORY_CONTRACT" ] && { echo "❌ Error al extraer dirección de fábrica"; exit 1; }

validate_eth_address "$MAINNET_IMPLEMENTATION_CONTRACT" "MAINNET_IMPLEMENTATION_CONTRACT"
validate_eth_address "$MAINNET_FACTORY_CONTRACT" "MAINNET_FACTORY_CONTRACT"

echo "✅ Implementación desplegada en: $MAINNET_IMPLEMENTATION_CONTRACT"
echo "✅ Fábrica desplegada en: $MAINNET_FACTORY_CONTRACT"

# --- Actualización del .env (sin duplicados) ---
echo "💾 Actualizando archivo .env..."
touch .env # Asegurar que el archivo existe

# Función para actualizar o añadir variable
update_env_var() {
    local var_name="$1"
    local var_value="$2"
    
    # Eliminar la variable si ya existe
    grep -v "^$var_name=" .env > .env.tmp || true
    # Añadir la nueva variable
    echo "$var_name=$var_value" >> .env.tmp
    # Reemplazar el archivo original
    mv .env.tmp .env
}

update_env_var "MAINNET_IMPLEMENTATION_CONTRACT" "$MAINNET_IMPLEMENTATION_CONTRACT"
update_env_var "MAINNET_FACTORY_CONTRACT" "$MAINNET_FACTORY_CONTRACT"

# --- Paso final ---
echo "🧪 Ejecutando creación de clon inicial..."
pnpm tsx scripts/createClone.ts

echo -e "\n✅ Despliegue completado exitosamente!"
echo "   - Implementación: $MAINNET_IMPLEMENTATION_CONTRACT"
echo "   - Fábrica: $MAINNET_FACTORY_CONTRACT"