// scripts/testExecuteMainnet.ts
import { ethers, Contract } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { NETWORKS, SupportedNetwork } from "../src/config/networks";
import { getAaveLiquidity } from "../src/services/liquidityService";
import { sendTelegramMessage } from "../src/services/telegramService";
import FlashLoanABI from "../src/abi/FlashLoanArbitrageOptimized.json";

// 1. Configuración inicial
dotenv.config({ path: path.join(__dirname, "../.env") });

// 2. Conexión mejorada al provider
async function setupProvider(): Promise<ethers.providers.WebSocketProvider> {
    const wsUrl = process.env.ETHEREUM_WS_URL;
    if (!wsUrl) throw new Error("ETHEREUM_WS_URL no definido en .env");

    const provider = new ethers.providers.WebSocketProvider(wsUrl, {
        name: "mainnet",
        chainId: 1
    });

    try {
        console.log("🔌 Conectando a Alchemy...");
        const network = await provider.getNetwork();
        console.log(`✅ Conectado a ${network.name} (Chain ID: ${network.chainId})`);
        return provider;
    } catch (error) {
        console.error("❌ Error de conexión:", error);
        throw new Error("No se pudo conectar a la red");
    }
}

// 3. Lógica principal de arbitraje
async function executeArbitrageTest() {
    const provider = await setupProvider();
    const network: SupportedNetwork = "mainnet";
    const config = NETWORKS[network];

    // Configuración inicial
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
    const flashloanContract = new Contract(
        config.CONTRACT_ADDRESSES.FLASHLOAN_CONTRACT,
        FlashLoanABI.abi,
        wallet
    );

    // 1. Verificar liquidez en Aave
    const loanAsset = config.CONTRACT_ADDRESSES.WETH;
    const aaveLiquidity = await getAaveLiquidity(flashloanContract, loanAsset, provider);

    if (aaveLiquidity.amount.lte(0)) {
        throw new Error("⚠️ No hay liquidez suficiente en Aave");
    }

    // 2. Ejecutar prueba de arbitraje
    console.log("🔍 Buscando oportunidades de arbitraje...");
    
    const testTx = await flashloanContract.callStatic.executeTestArbitrage(
        loanAsset,
        ethers.utils.parseEther("1"), // 1 ETH como cantidad de prueba
        { gasLimit: 5000000 }
    );

    console.log("🧪 Resultado de prueba:", testTx);
    await sendTelegramMessage(`✅ Prueba exitosa en Mainnet\nResultado: ${JSON.stringify(testTx)}`);

    return testTx;
}

// 4. Ejecución con manejo de errores
async function main() {
    try {
        await executeArbitrageTest();
        process.exit(0);
    } catch (error) {
        const err = error as Error;
        console.error("❌ Error en testExecuteMainnet:", err.message);
        await sendTelegramMessage(`❌ Fallo en prueba Mainnet: ${err.message}`);
        process.exit(1);
    }
}

main();