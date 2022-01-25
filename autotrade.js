const Web3 = require('web3');
const axios = require('axios');
const abi = require('./abi.json');
const secrets = require('./secrets.json');
const web3 = new Web3(new Web3.providers.HttpProvider(secrets.provider));
const panRouterContractAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
const sender_address = '' //我的钱包地址
const tokenToBuy = "0x7b86b0836f3454e50c6f6a190cd692bb17da1928"
const spend = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
const privateKey = '' //我的私钥
const contract = new web3.eth.Contract(abi.abi, panRouterContractAddress)
let buy_orders = new Set()
let sell_orders = new Set()

let watchAddr = "" //跟踪人的地址

async function sendMsg(stt) {
    try {
        await axios.post('', {//推送的钉钉webhook 可以
            msgtype: "text",
            text: {
                "content": stt
            },
        });
    } catch (error) {
        console.log(error)
    }
}

class TransactionChecker {


    async checkBlock() {
        let tx;
        let blockNumber = await web3.eth.getBlockNumber()



        let block = await web3.eth.getBlock(blockNumber, true)
        if (block && block.transactions) {
            for (const e of block.transactions) {
                let a = web3.utils.fromWei(e.value)
                if (e.to !== null) {


                    //console.log(e)
                    if (watchAddr.toLowerCase() === e.from.toLowerCase()) {
                        console.log(e)
                        if (parseFloat(a) === 0) {

                            if (sell_orders.has(String(e.hash))) continue
                            sell_orders.add(String(e.hash))


                            const selltoken = new web3.eth.Contract(abi.sell_abi, tokenToBuy)
                            let tokenbalance = await selltoken.methods.balanceOf(sender_address).call()
                            let tokenread = web3.utils.fromWei(tokenbalance)
                            console.log(tokenread)

                            //swapExactTokensForETH，卖出
                            //swapExactETHForTokens，买入


                            let sell_data = contract.methods.swapExactTokensForETH(
                                tokenbalance,//卖的token的数量
                                0,//min buy
                                [tokenToBuy, spend],
                                sender_address,
                                web3.utils.toHex(Math.round(Date.now() / 1000) + 60 * 20)
                            )
                            const accountNonce = await web3.eth.getTransactionCount(sender_address)
                            tx = {
                                gas: 600000,
                                gasLimit:600000,
                                gasPrice: web3.utils.toWei('20', "gwei"),
                                maxPriorityFeePerGas:web3.utils.toWei('10', "gwei"),//優先交易費
                                // value:web3.utils.toWei('0.001' ),//使用BNB的数量
                                from: sender_address,
                                nonce: web3.utils.toHex(accountNonce),
                                to: panRouterContractAddress,
                                data: sell_data.encodeABI(),
                            };
                            let account = await web3.eth.accounts.privateKeyToAccount(privateKey);
                            let signed = await account.signTransaction(tx)
                            console.log(signed.rawTransaction)
                            let ss = await web3.eth.sendSignedTransaction(signed.rawTransaction)
                            console.log(ss)
                            sendMsg("【跟踪卖出】:" +
                                "\nfrom：" + String(e.from) +
                                "\nto：" + String(e.to) +
                                "\nhash：" + String(e.hash) +
                                "\n区块：" + String(blockNumber) +
                                "\n数量：" + String(web3.utils.fromWei(e.value))
                            )

                        } else {


                            if (buy_orders.has(String(e.hash))) continue
                            buy_orders.add(String(e.hash))

                            let buy_data = contract.methods.swapExactETHForTokens(
                                // web3.utils.toWei(String(buy_amount-(buy_amount*0.001)), "ether"),//购买代币的数量
                                0,
                                [spend, tokenToBuy],
                                sender_address,
                                web3.utils.toHex(Math.round(Date.now() / 1000) + 60 * 20)
                            )

                            const accountNonce = await web3.eth.getTransactionCount(sender_address)
                            tx = {
                                gas: 600000,
                                gasLimit:600000,
                                gasPrice: web3.utils.toWei('20', "gwei"),
                                value: web3.utils.toWei('0.1'),//使用BNB的数量
                                maxPriorityFeePerGas:web3.utils.toWei('10', "gwei"),//優先交易費
                                from: sender_address,
                                nonce: web3.utils.toHex(accountNonce),
                                to: panRouterContractAddress,
                                data: buy_data.encodeABI(),
                            };

                            let account = await web3.eth.accounts.privateKeyToAccount(privateKey);
                            let signed = await account.signTransaction(tx)
                            console.log(signed.rawTransaction)
                            let ss = await web3.eth.sendSignedTransaction(signed.rawTransaction)
                            console.log(ss)


                            await sendMsg("【跟踪买入】:" +
                                "\nfrom：" + String(e.from) +
                                "\nto：" + String(e.to) +
                                "\nhash：" + String(e.hash) +
                                "\n区块：" + String(blockNumber) +
                                "\n数量：" + String(web3.utils.fromWei(e.value))
                            )

                        }

                    }

                }

            }
        }
    }
}

var transactionChecker = new TransactionChecker(watchAddr);

async function ing() {
    while (true) {
        await transactionChecker.checkBlock()
        // process.exit()
    }
}

ing()
