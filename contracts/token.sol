/**
    StakeMars Protocol ("STT")

    This project was launched as a fairlaunch.

    Features:

    10% fees per transaction
    - 4% fee per transaction : auto add to the liquidity pool
    - 4% fee per transaction : allocate to STT stakers
    - 1% fee per transaction : burn to dead wallet
    - 1% fee per transaction : marketing and operational expenses

    100,000,000 total supply

*/

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./IUniswapV2Pair.sol";
import "./IUniswapV2Factory.sol";
import "./IUniswapV2Router02.sol";
import "./BaseERC20.sol";

interface IStaking {
    function distribute() external payable;
}

contract StakeMars is BaseERC20 {
    mapping(address => bool) private _whitelist;

    IUniswapV2Router02 public uniswapV2Router;
    address public uniswapV2Pair;

    IStaking public stakingAddress;

    // Marketing wallet
    address public mktAddress;

    // Burn wallet
    address public constant burnTo = address(0x000000000000000000000000000000000000dEaD);

    // 10% tax, 4% to stake contract, 4% LP, 1% burn and 1% marketing expenses
    uint8 private constant swapPercentage = 10;
    uint256 private minSwapAmount;
    uint256 private maxSwapAmount;

    // Set Max transaction
    uint256 public maxTxAmountBuy = 100000 * 10**18;
    uint256 public maxTxAmountSell = 100000 * 10**18;

    //Transction types
    uint256 private buying = 0;
    uint256 private selling = 1;
    uint256 private transferring = 2;

    // Supply: 100,000,000 (10^8)
    constructor() BaseERC20("Shitty Token", "STT", 18, 10**8) {
        _balances[_msgSender()] = _totalSupply;
        minSwapAmount = 1000 * 10**_decimals;
        maxSwapAmount = 12000 * 10**_decimals;

        // Pancakeswap (Testnet): 0xD99D1c33F9fC3444f8101754aBC46c52416550D1
        // Pancakeswap (Testnet2): 0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3
        // Pancakeswap v2 (Mainnet): 0x10ED43C718714eb63d5aA57B78B54704E256024E
        IUniswapV2Router02 _uniswapV2Router =
        IUniswapV2Router02(0x10ED43C718714eb63d5aA57B78B54704E256024E);
        uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory())
        .createPair(address(this), _uniswapV2Router.WETH());

        uniswapV2Router = _uniswapV2Router;

        // Dead wallet, Contract and owner should always be whitelisted
        _whitelist[burnTo] = true;
        _whitelist[address(this)] = true;
        _whitelist[owner()] = true;

        emit Transfer(address(0), _msgSender(), _totalSupply);
    }

    /**
     * ERC20 functions & helpers
     */

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(
            _balances[sender] >= amount,
            "ERC20: transfer amount exceeds balance"
        );

        if (_isWhitelisted(sender, recipient)) {
            _noFeeTransfer(sender, recipient, amount);
        } else {
            uint256 tType = selling;
            if(sender != uniswapV2Pair && recipient != uniswapV2Pair) tType = transferring;
            else if(sender == uniswapV2Pair) tType = buying;
            if(tType == 0){ //Buy
                require(amount <= maxTxAmountBuy, "Transfer amount exceeds the maxTxAmountBuy.");
            }else if(tType == 1){ //Sell
                require(amount <= maxTxAmountSell, "Transfer amount exceeds the maxTxAmountSell.");
            }
            _feeTransfer(sender, recipient, amount);
        }

        emit Transfer(sender, recipient, amount);
    }

    function _feeTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) private {
        _swap(sender);
        uint256 tax = (amount * swapPercentage) / 100;
        uint256 mktAmount = tax / 10;
        uint256 addLpBurnAndStakeAmount = tax - (mktAmount * 2);
        _balances[address(this)] += addLpBurnAndStakeAmount;
        _balances[mktAddress] += mktAmount;
        _balances[burnTo] += mktAmount;
        _balances[sender] -= amount;
        _balances[recipient] += amount - tax;
    }

    function _noFeeTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) private {
        _balances[sender] -= amount;
        _balances[recipient] += amount;
    }

    function _isWhitelisted(address address1, address address2)
    private
    view
    returns (bool)
    {
        return _whitelist[address1] || _whitelist[address2];
    }

    /**
     * Uniswap code & distribute method
     */

    receive() external payable {}

    function _swap(address sender) private {
        uint256 contractTokenBalance = _balances[address(this)];
        bool shouldSell = contractTokenBalance >= minSwapAmount;

        if (
            shouldSell &&
            sender != uniswapV2Pair
        ) {
            if(contractTokenBalance >= maxSwapAmount) contractTokenBalance = maxSwapAmount;
            uint256 stakingShare = contractTokenBalance / 2;
            uint256 liquidityShare = contractTokenBalance - stakingShare;
            uint256 swapShare =
            stakingShare + (liquidityShare / 2);
            swapTokensForEth(swapShare);
            uint256 balance = address(this).balance;

            uint256 stakingBnbShare = (4 * balance) / 6;
            uint256 liquidityBnbShare = balance - stakingBnbShare;

            stakingAddress.distribute{value: stakingBnbShare}();

            addLiquidity(liquidityShare / 2, liquidityBnbShare);
            emit Swap(contractTokenBalance, balance);
        }
    }

    function swapTokensForEth(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();
        _approve(address(this), address(uniswapV2Router), tokenAmount);
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        _approve(address(this), address(uniswapV2Router), tokenAmount);
        uniswapV2Router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0,
            0,
            owner(),
            block.timestamp
        );
    }

    event Swap(uint256 tokensSwapped, uint256 ethReceived);
    event Whitelist(address whitelisted, bool isWhitelisted);
    event UpdateStakingAddress(address stakingAddress);
    event UpdateMktAddress(address mktAddress);

    /**
     * Misc. functions
     */

    function setStakingAddress(address newAddress) external onlyOwner {
        require(
            address(stakingAddress) == address(0),
            "Staking address already set"
        );
        stakingAddress = IStaking(newAddress);
        _whitelist[address(newAddress)] = true;
        emit UpdateStakingAddress(newAddress);
    }

    function updateWhitelist(address addr, bool isWhitelisted)
    external
    onlyOwner
    {
        _whitelist[addr] = isWhitelisted;
        emit Whitelist(addr, isWhitelisted);
    }

    function setMktAddress(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Mkt address is the zero address");
        mktAddress = address(newAddress);
        emit UpdateMktAddress(newAddress);
    }
}