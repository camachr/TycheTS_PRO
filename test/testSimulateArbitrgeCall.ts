// test/testSimulateArbitrgeCall.ts
import { ethers } from "ethers";

async function diagnoseFlashLoanExecution() {
  // Configuración del provider y signer con tu cuenta ejecutor
  const RPC_URL = "http://127.0.0.1:8545";
  const PRIVATE_KEY = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"; // reemplaza con la clave privada del ejecutor, p.ej. del output: 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Direcciones según último output
  const ARBITRAGE_CONTRACT_ADDRESS = "0x0C8E79F3534B00D9a3D4a856B665Bf4eBC22f2ba";
  const TEST_TOKEN_IN_ADDRESS = "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35";  // MOCK USDC
  const TEST_TOKEN_OUT_ADDRESS = "0xA15BB66138824a1c7167f5E85b957d04Dd34E468"; // MOCK WETH

  // ABI simplificado con funciones necesarias
  const arbitrageAbi = [
    "function hasRole(bytes32,address) view returns (bool)",
    "function tokenWhitelist(address) view returns (bool)",
    "function executeFlashLoanAave(address,uint256,address[],address[],address[],uint256[],uint256,uint256,uint256) payable"
  ];

  const arbitrageContract = new ethers.Contract(
    ARBITRAGE_CONTRACT_ADDRESS,
    arbitrageAbi,
    wallet
  );

  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 0x00..00

  // 1. Verificar que el contrato está desplegado
  const code = await provider.getCode(ARBITRAGE_CONTRACT_ADDRESS);
  if (code === "0x") {
    console.error("❌ El contrato no está desplegado en la dirección especificada");
    return;
  }
  console.log("✅ Contrato desplegado. Bytecode length:", code.length);

  // 2. Verificar red
  const network = await provider.getNetwork();
  console.log(`✅ Conectado a red: ${network.name} (chainId: ${network.chainId})`);

  // 3. Verificar que los tokens están en whitelist
  console.log(`Whitelist tokenIn (${TEST_TOKEN_IN_ADDRESS}):`, await arbitrageContract.tokenWhitelist(TEST_TOKEN_IN_ADDRESS));
  console.log(`Whitelist tokenOut (${TEST_TOKEN_OUT_ADDRESS}):`, await arbitrageContract.tokenWhitelist(TEST_TOKEN_OUT_ADDRESS));

  // 4. Parametros para la llamada a executeFlashLoanAave
  const asset = TEST_TOKEN_IN_ADDRESS;
  const amount = ethers.utils.parseUnits("1000", 6); // 1000 tokens con decimales 6 (USDC)
  const routers = [
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // router UniswapV2 (WETH)
    "0xd9e1CE17f2641f24aE83637Ab66a2cca9C378B9F" // router SushiSwap
  ];
  const tokensIn = [TEST_TOKEN_IN_ADDRESS, TEST_TOKEN_IN_ADDRESS];
  const tokensOut = [TEST_TOKEN_OUT_ADDRESS, TEST_TOKEN_OUT_ADDRESS];
  const fees = [0, 0];
  const slippageBps = 100;
  const minProfit = ethers.utils.parseEther("0.001"); // 0.001 ETH mínimo beneficio
  const mevBribe = ethers.utils.parseEther("0.01");   // 0.01 ETH para MEV bribe

  // 5. Intentar ejecutar el flashloan con gas límite alto
  try {
    console.log("⏳ Ejecutando flashloan con gas limit manual...");
    const tx = await arbitrageContract.executeFlashLoanAave(
      asset,
      amount,
      routers,
      tokensIn,
      tokensOut,
      fees,
      slippageBps,
      minProfit,
      mevBribe,
      { gasLimit: 5_000_000, value: mevBribe }
    );
    const receipt = await tx.wait();
    console.log("✅ Flashloan ejecutado con éxito. Tx hash:", receipt.transactionHash);
  } catch (error: any) {
    console.error("❌ Error ejecutando flashloan:", error);
  }
}

diagnoseFlashLoanExecution().catch(console.error);
