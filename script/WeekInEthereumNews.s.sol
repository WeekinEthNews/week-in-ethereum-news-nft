// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {WeekInEthereumNews} from "../src/WeekInEthereumNews.sol";

contract WeekInEthereumNewsScript is Script {
    WeekInEthereumNews public nft;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        nft = new WeekInEthereumNews(msg.sender);

        vm.stopBroadcast();
    }
}
