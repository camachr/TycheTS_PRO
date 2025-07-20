// src/debug/simulateArbitrageCall.ts
import { ethers, BigNumber, Contract } from 'ethers';
import FlashLoanArbitrageOptimizedABI from '../abi/FlashLoanArbitrageOptimized.json'; // Asegúrate que este ABI esté completo
import { Interface } from 'ethers/lib/utils';

// Constantes del flashloan
const TEST_FLASH_LOAN_AMOUNT = ethers.utils.parseUnits("1000", 6); // USDC asumiendo 6 decimales

// Direcciones originales sin validar aún
const RAW_TEST_TOKEN_IN_ADDRESS = "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35"; // MOCK USDC
const RAW_TEST_TOKEN_OUT_ADDRESS = "0xA15BB66138824a1c7167f5E85b957d04Dd34E468"; // MOCK WETH
const RAW_ARBITRAGE_CONTRACT_ADDRESS = "0x0C8E79F3534B00D9a3D4a856B665Bf4eBC22f2ba"; // Contrato arbitraje

const RAW_TEST_DEX1_ROUTER = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d"; // Uniswap V2
const RAW_TEST_DEX2_ROUTER = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f"; // SushiSwap

const RAW_DEPLOYER_ADMIN_ADDRESS = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"; // Admin deployer
const RAW_ADMIN_ACCOUNT_TO_IMPERSONATE = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"; // Lo mismo para impersonate


// Otros parámetros
const TEST_FEES = [0, 0]; 
const TEST_SLIPPAGE_BPS = 100; // 1% slippage
const TEST_MIN_PROFIT = BigNumber.from('1000000000000000'); // 0.001 ETH
const TEST_MEV_BRIBE = BigNumber.from('10000000000000000'); // 0.01 ETH

// Función para validar dirección con ethers y arrojar error si no es válida
function validateAddress(address: string, name: string) {
    try {
        ethers.utils.getAddress(address);
    } catch {
        throw new Error(`La dirección ${name} (${address}) tiene checksum inválido o formato incorrecto.`);
    }
}

async function simulateArbitrageCall() {
    console.log("Validando direcciones de contrato y tokens...");

    // Validar antes de continuar
    validateAddress(RAW_TEST_TOKEN_IN_ADDRESS, "Token entrada");
    validateAddress(RAW_TEST_TOKEN_OUT_ADDRESS, "Token salida");
    validateAddress(RAW_ARBITRAGE_CONTRACT_ADDRESS, "Contrato arbitraje");
    validateAddress(RAW_TEST_DEX1_ROUTER, "Router 1");
    validateAddress(RAW_TEST_DEX2_ROUTER, "Router 2");
    validateAddress(RAW_DEPLOYER_ADMIN_ADDRESS, "Admin deployer");
    validateAddress(RAW_ADMIN_ACCOUNT_TO_IMPERSONATE, "Admin impersonado");

    // Convertir a direcciones con checksum, normalizadas
    const TEST_TOKEN_IN_ADDRESS = ethers.utils.getAddress(RAW_TEST_TOKEN_IN_ADDRESS);
    const TEST_TOKEN_OUT_ADDRESS = ethers.utils.getAddress(RAW_TEST_TOKEN_OUT_ADDRESS);
    const ARBITRAGE_CONTRACT_ADDRESS = ethers.utils.getAddress(RAW_ARBITRAGE_CONTRACT_ADDRESS);
    const TEST_DEX1_ROUTER = ethers.utils.getAddress(RAW_TEST_DEX1_ROUTER);
    const TEST_DEX2_ROUTER = ethers.utils.getAddress(RAW_TEST_DEX2_ROUTER);
    const DEPLOYER_ADMIN_ADDRESS = ethers.utils.getAddress(RAW_DEPLOYER_ADMIN_ADDRESS);
    const ADMIN_ACCOUNT_TO_IMPERSONATE = ethers.utils.getAddress(RAW_ADMIN_ACCOUNT_TO_IMPERSONATE);

    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    const network = await provider.getNetwork();
    console.log(`Conectado a la red: ${network.name} (Chain ID: ${network.chainId})`);

    // Obtener firma y dirección para el ejecutor
    const signers = await provider.listAccounts();
    const executorWallet = provider.getSigner(signers[0]);
    const executorAddress = await executorWallet.getAddress();
    console.log(`Usando cuenta ejecutora: ${executorAddress}`);
    console.log(`Balance del ejecutor: ${ethers.utils.formatEther(await executorWallet.getBalance())} ETH`);

    // Instancia del contrato
    const arbitrageContract = new Contract(
        ARBITRAGE_CONTRACT_ADDRESS,
        FlashLoanArbitrageOptimizedABI,
        executorWallet
    );
    console.log(`Instancia del contrato de arbitraje en: ${arbitrageContract.address}`);

    // Roles
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const OPERATOR_ROLE = "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929";

    // Verificar deployer admin
    const isDeployerAdmin = await arbitrageContract.hasRole(DEFAULT_ADMIN_ROLE, DEPLOYER_ADMIN_ADDRESS);
    console.log("¿Deployer es admin?", isDeployerAdmin);
    if (!isDeployerAdmin) {
        throw new Error(`La cuenta deployer (${DEPLOYER_ADMIN_ADDRESS}) no es admin. No se puede continuar.`);
    }

    // Conceder role admin si hace falta a admin impersonado
    if (ADMIN_ACCOUNT_TO_IMPERSONATE !== DEPLOYER_ADMIN_ADDRESS) {
        let isNewAdmin = await arbitrageContract.hasRole(DEFAULT_ADMIN_ROLE, ADMIN_ACCOUNT_TO_IMPERSONATE);
        if (!isNewAdmin) {
            console.log(`Concediendo DEFAULT_ADMIN_ROLE a: ${ADMIN_ACCOUNT_TO_IMPERSONATE}`);
            const deployerSigner = provider.getSigner(DEPLOYER_ADMIN_ADDRESS);
            const arbitAsDeployer = arbitrageContract.connect(deployerSigner);

            const tx = await arbitAsDeployer.grantRole(DEFAULT_ADMIN_ROLE, ADMIN_ACCOUNT_TO_IMPERSONATE);
            await tx.wait();
            console.log("Transacción admin concedida.");
        } else {
            console.log(`Cuenta ${ADMIN_ACCOUNT_TO_IMPERSONATE} ya tiene DEFAULT_ADMIN_ROLE.`);
        }
    }

    // Impersonar cuenta si es distinta
    if (ADMIN_ACCOUNT_TO_IMPERSONATE !== DEPLOYER_ADMIN_ADDRESS) {
        console.log(`Impersonando cuenta ADMIN: ${ADMIN_ACCOUNT_TO_IMPERSONATE}...`);
        await provider.send("anvil_impersonateAccount", [ADMIN_ACCOUNT_TO_IMPERSONATE]);
    }

    const adminSigner = provider.getSigner(ADMIN_ACCOUNT_TO_IMPERSONATE);
    const adminArbitrageContract = arbitrageContract.connect(adminSigner);

    try {
        // Añadir tokens a whitelist si hace falta
        const isTokenInWhitelisted = await adminArbitrageContract.tokenWhitelist(TEST_TOKEN_IN_ADDRESS);
        if (!isTokenInWhitelisted) {
            console.log(`Añadiendo ${TEST_TOKEN_IN_ADDRESS} a la whitelist con cuenta ADMIN...`);
            const txAddTokenIn = await adminArbitrageContract.addTokenToWhitelist(TEST_TOKEN_IN_ADDRESS);
            await txAddTokenIn.wait();
            console.log("Token de entrada añadido a whitelist.");
        } else {
            console.log(`Token de entrada ya está en whitelist.`);
        }

        const isTokenOutWhitelisted = await adminArbitrageContract.tokenWhitelist(TEST_TOKEN_OUT_ADDRESS);
        if (!isTokenOutWhitelisted) {
            console.log(`Añadiendo ${TEST_TOKEN_OUT_ADDRESS} a la whitelist con cuenta ADMIN...`);
            const txAddTokenOut = await adminArbitrageContract.addTokenToWhitelist(TEST_TOKEN_OUT_ADDRESS);
            await txAddTokenOut.wait();
            console.log("Token de salida añadido a whitelist.");
        } else {
            console.log(`Token de salida ya está en whitelist.`);
        }

        // Conceder rol OPERATOR_ROLE al ejecutor si no lo tiene
        const isExecutorOperator = await adminArbitrageContract.hasRole(OPERATOR_ROLE, executorAddress);
        if (!isExecutorOperator) {
            console.log(`Concediendo OPERATOR_ROLE a cuenta ejecutora: ${executorAddress}...`);
            const txGrantRole = await adminArbitrageContract.grantRole(OPERATOR_ROLE, executorAddress);
            await txGrantRole.wait();
            console.log("OPERATOR_ROLE concedido al ejecutor.");
        } else {
            console.log(`Cuenta ejecutora ya tiene OPERATOR_ROLE.`);
        }
    } catch (e: any) {
        console.error(`🔴 ERROR crítico en configuración de roles/whitelist: ${e.message}`);
        process.exit(1);
    } finally {
        if (ADMIN_ACCOUNT_TO_IMPERSONATE !== DEPLOYER_ADMIN_ADDRESS) {
            // await provider.send("anvil_stopImpersonateAccount", [ADMIN_ACCOUNT_TO_IMPERSONATE]);
            console.log(`Impersonación de ${ADMIN_ACCOUNT_TO_IMPERSONATE} terminada (si fue iniciada).`);
        }
    }

    // Preparar argumentos para ejecución flashloan
    const flashLoanArgs = [
        TEST_TOKEN_IN_ADDRESS,
        TEST_FLASH_LOAN_AMOUNT,
        [TEST_DEX1_ROUTER, TEST_DEX2_ROUTER],
        [TEST_TOKEN_IN_ADDRESS, TEST_TOKEN_IN_ADDRESS],
        [TEST_TOKEN_OUT_ADDRESS, TEST_TOKEN_OUT_ADDRESS],
        TEST_FEES,
        TEST_SLIPPAGE_BPS,
        TEST_MIN_PROFIT,
        TEST_MEV_BRIBE
    ];

    // Mostrar argumentos
    const decimals = await getTokenDecimals(provider, TEST_TOKEN_IN_ADDRESS);
    console.log("\nArgumentos para executeFlashLoanAave:");
    console.log(`  asset: ${flashLoanArgs[0]}`);
    console.log(`  amount: ${ethers.utils.formatUnits(flashLoanArgs[1] as ethers.BigNumberish, decimals)}`);
    console.log(`  routers: ${(flashLoanArgs[2] as string[]).join(', ')}`);
    console.log(`  tokensIn: ${(flashLoanArgs[3] as string[]).join(', ')}`);
    console.log(`  tokensOut: ${(flashLoanArgs[4] as string[]).join(', ')}`);
    console.log(`  fees: ${(flashLoanArgs[5] as number[]).join(', ')}`);
    console.log(`  slippageBps: ${flashLoanArgs[6]}`);
    console.log(`  minProfit: ${ethers.utils.formatEther(flashLoanArgs[7] as ethers.BigNumberish)} ETH`);
    console.log(`  mevBribe: ${ethers.utils.formatEther(flashLoanArgs[8] as ethers.BigNumberish)} ETH`);

    try {
        console.log("\nEstimando gas...");
        const estimatedGas = await arbitrageContract.estimateGas.executeFlashLoanAave(
            ...flashLoanArgs,
            { value: flashLoanArgs[8] }
        );
        console.log(`✅ Gas estimado: ${estimatedGas.toString()}`);

        console.log("\nSimulando con callStatic...");
        const simulatedResult = await arbitrageContract.callStatic.executeFlashLoanAave(
            ...flashLoanArgs,
            { value: flashLoanArgs[8] }
        );
        console.log(`✅ Profit simulado: ${ethers.utils.formatEther(simulatedResult)} ETH`);

        console.log("\nEnviando transacción real...");
        const txResponse = await arbitrageContract.executeFlashLoanAave(
            ...flashLoanArgs,
            { value: flashLoanArgs[8] }
        );
        console.log(`Transacción enviada. Hash: ${txResponse.hash}`);
        const receipt = await txResponse.wait();
        console.log(`✅ Transacción minada. Bloque: ${receipt.blockNumber}, Gas usado: ${receipt.gasUsed.toString()}`);
        console.log("¡Arbitraje simulado exitosamente!");
    } catch (error: any) {
        console.error("\n--- 🔴 ERROR DETECTADO ---");
        console.error("Error en executeFlashLoanAave:");

        const iface = new Interface(FlashLoanArbitrageOptimizedABI);
        let decodedMessage = '';

        const errorData = error.data || (error.error && error.error.data);
        if (errorData && typeof errorData === 'string' && errorData.startsWith('0x')) {
            try {
                const parsedError = iface.parseError(errorData);
                decodedMessage = `Contract Revert: ${parsedError.name}(${parsedError.args.map((arg: any) => arg.toString()).join(', ')}). `;
            } catch (e) {
                if (errorData === '0x08c379a0' || errorData.startsWith('0x08c379a0')) {
                    try {
                        const reason = ethers.utils.toUtf8String('0x' + errorData.slice(10));
                        decodedMessage = `Contract Revert (string): ${reason}. `;
                    } catch {
                        decodedMessage = `Unknown Contract Revert Data (could not decode string): ${errorData}. `;
                    }
                } else if (errorData === '0x4e487b71') {
                    decodedMessage = `Contract Panic (Solidity Error). `;
                } else {
                    decodedMessage = `Raw Contract Data: ${errorData}. `;
                }
            }
        }

        if (!decodedMessage && error.reason) decodedMessage = `Reason: ${error.reason}. `;
        if (!decodedMessage && error instanceof Error) decodedMessage = error.message;
        if (!decodedMessage) decodedMessage = String(error);

        console.error(`Mensaje Decodificado: ${decodedMessage.trim()}`);
        console.error("Objeto de error completo:", error);
    }
}

// Helper para obtener decimales del token
async function getTokenDecimals(provider: ethers.providers.Provider, tokenAddress: string): Promise<number> {
    const ERC20_ABI = ["function decimals() view returns (uint8)"];
    try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
        return await tokenContract.decimals();
    } catch (error) {
        console.warn(`No se pudieron obtener decimales para ${tokenAddress}, usando 18. Error: ${error instanceof Error ? error.message : String(error)}`);
        return 18;
    }
}

simulateArbitrageCall().catch(console.error);
