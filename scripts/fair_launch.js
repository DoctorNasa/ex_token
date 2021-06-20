module.exports = async({ getNameAccounts,deployment}) => {
    const {deploy} = deployment;
    const {deployer} = await getNameAccounts();
    const xxxToken = await ether.getcontract('xxxToken.sol');
    const xxxToken_per_Block = '60';
    const Start_Block = '1000';
    const Bonus_Lockup_BPS = '100';
    const Bonus_End_Block = '100';
    await deploy('FairLunach', {
        from: deployer,
        args:[xxxToken.address, deployer, xxxToken_per_Block,Start_Block,Bonus_Lockup_BPS,Bonus_End_Block],
        log: true
    });
};

module.exports.tags =['FairLaunch'];