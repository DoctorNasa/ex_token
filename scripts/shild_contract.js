const { expect, assert } = require('chai');
const { getNamedAccounts, ethers } = require('hardhat');

describe('Using Shield contract for fixing the unlimited minting issue', async () => {
  let deployer;

  before(async () => {
    await deployments.fixture();
    const namedAccounts = await getNamedAccounts();
    deployer = namedAccounts.deployer;
  });

  it('Mint on fair launch', async () => {
    const FairLaunch = await ethers.getContract('FairLaunch');
    const XxxToken = await ethers.getContract('XxxToken');
    console.log('XxxToken', XxxToken.address);
    console.log('FairLaunch', FairLaunch.address);
    let result;
    result = await XxxToken.transferOwnership(FairLaunch.address);
    const XxxOwner = await XxxToken.owner();
    expect(XxxOwner).eq(FairLaunch.address);

    const oldBalance = await XxxToken.balanceOf(deployer);
    console.log('oldBalance', ethers.utils.formatEther(oldBalance));
    const mintAmount = ethers.utils.parseEther('600000');
    result = await FairLaunch.manualMint(deployer, mintAmount);
    assert.ok(result);

    const newBalance = await XxxToken.balanceOf(deployer);
    console.log('newBalance', ethers.utils.formatEther(newBalance));
    expect(newBalance).eq(oldBalance.add(mintAmount));
  });

  it('Can deploy shield', async () => {
    const FairLaunch = await ethers.getContract('FairLaunch');
    const Shield = await ethers.getContractFactory('Shield');
    const shield = await Shield.deploy(deployer, FairLaunch.address);
    assert.ok(shield);

    console.log('Shield address', shield.address);
  });

  it('Can not mint from Shield before transfer ownership', async () => {
    const Shield = await ethers.getContract('Shield');
    const mintAmount = ethers.utils.parseEther('600000');
    try {
      await Shield.mintWarchest(deployer, mintAmount);
    } catch (err) {
      // error means reverted
      assert.ok(err);
    }
  });

  it('Can transfer owner of FairLaunch to Shield', async () => {
    const FairLaunch = await ethers.getContract('FairLaunch');
    const Shield = await ethers.getContract('Shield');
    const result = await FairLaunch.transferOwnership(Shield.address);
    assert.ok(result);

    const newOwner = await FairLaunch.owner();
    console.log('newOwner', newOwner);
    expect(newOwner).eq(Shield.address);
  });

  it('Can manualMint lower than limit', async () => {
    const XxxToken = await ethers.getContract('XxxToken');
    const Shield = await ethers.getContract('Shield');
    const oldBalance = await XxxToken.balanceOf(deployer);
    console.log('oldBalance', ethers.utils.formatEther(oldBalance));
    const mintAmount = ethers.utils.parseEther('600000');
    const result = await Shield.mintWarchest(deployer, mintAmount);
    assert.ok(result);

    const newBalance = await XxxToken.balanceOf(deployer);
    console.log('newBalance', ethers.utils.formatEther(newBalance));
    expect(newBalance).gt(oldBalance);
  });

  it('Can manualMint equal the limit', async () => {
    const XxxToken = await ethers.getContract('XxxToken');
    const Shield = await ethers.getContract('Shield');
    const oldBalance = await XxxToken.balanceOf(deployer);
    console.log('oldBalance', ethers.utils.formatEther(oldBalance));
    const mintLimit = await Shield.mintLimit();
    const mintCount = await Shield.mintCount();
    const mintRemaining = mintLimit.sub(mintCount);
    const result = await Shield.mintWarchest(deployer, mintRemaining);
    assert.ok(result);

    const newBalance = await XxxToken.balanceOf(deployer);
    console.log('newBalance', ethers.utils.formatEther(newBalance));
    expect(newBalance).eq(mintLimit);
  });

  it('Can not mint exceed the limit', async () => {
    const Shield = await ethers.getContract('Shield');
    const mintLimit = await Shield.mintLimit();
    const mintCount = await Shield.mintCount();
    const mintRemaining = mintLimit.sub(mintCount).add(1); // add 1 wei
    let result;
    try {
      result = await Shield.mintWarchest(deployer, mintRemaining);
    } catch (err) {
      // error means reverted
      assert.ok(err);
    }
    assert.ok(!result);
  });

  it('Can set Xxx per block by Shield', async () => {
    const Shield = await ethers.getContract('Shield');
    const FairLaunch = await ethers.getContract('FairLaunch');
    const XxxPerBlock = 50;
    const result = await Shield.setXxxPerBlock(XxxPerBlock);
    assert.ok(result);

    const newXxxPerBlock = await FairLaunch.XxxPerBlock();
    expect(newXxxPerBlock).eq(XxxPerBlock);
  });

  it('Can set bonus by Shield', async () => {
    const Shield = await ethers.getContract('Shield');
    const FairLaunch = await ethers.getContract('FairLaunch');
    const _bonusMultiplier = 5000;
    const _bonusEndBlock = 20;
    const _bonusLockUpBps = 60;
    const result = await Shield.setBonus(_bonusMultiplier, _bonusEndBlock, _bonusLockUpBps);
    assert.ok(result);

    const bonusMultiplier = await FairLaunch.bonusMultiplier();
    expect(bonusMultiplier).eq(_bonusMultiplier);

    const bonusEndBlock = await FairLaunch.bonusEndBlock();
    expect(bonusEndBlock).eq(_bonusEndBlock);

    const bonusLockUpBps = await FairLaunch.bonusLockUpBps();
    expect(bonusLockUpBps).eq(_bonusLockUpBps);
  });

  it('Can add pool by Shield', async () => {
    const Shield = await ethers.getContract('Shield');
    const FairLaunch = await ethers.getContract('FairLaunch');
    const _allocPoint = 5;
    const _stakeToken = '0x6666666666666666666666666666666666666666';
    const _withUpdate = true;
    const result = await Shield.addPool(_allocPoint, _stakeToken, _withUpdate);
    assert.ok(result);

    const poolLength = await FairLaunch.poolLength();
    expect(poolLength).gt(0);

    const poolInfo = await FairLaunch.poolInfo(0);
    expect(poolInfo.allocPoint).eq(_allocPoint);
    expect(poolInfo.stakeToken).eq(_stakeToken);
  });

  it('Can set pool by Shield', async () => {
    const Shield = await ethers.getContract('Shield');
    const FairLaunch = await ethers.getContract('FairLaunch');
    const _pid = 0;
    const _allocPoint = 2;
    const _withUpdate = true;
    const result = await Shield.setPool(_pid, _allocPoint, _withUpdate);
    assert.ok(result);

    const poolInfo = await FairLaunch.poolInfo(0);
    expect(poolInfo.allocPoint).eq(_allocPoint);
  });

  it('Can transfer ownership of FairLaunch back to dev address', async () => {
    const Shield = await ethers.getContract('Shield');
    const FairLaunch = await ethers.getContract('FairLaunch');
    const result = await Shield.transferFairLaunchOwnership(deployer);
    assert.ok(result);

    const newOwner = await FairLaunch.owner();
    expect(newOwner).eq(deployer);
  });

  it('Can not call FairLaunch methods by Shield', async () => {
    const Shield = await ethers.getContract('Shield');
    let result
    try {
      result = await Shield.transferFairLaunchOwnership(deployer);
    } catch (err) {
      assert.ok(err);
    }
    assert.ok(!result);
  });
});