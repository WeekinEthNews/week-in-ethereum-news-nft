// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {WeekInEthereumNews} from "../src/WeekInEthereumNews.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract WeekInEthereumNewsTest is Test {
    WeekInEthereumNews public nft;
    address public owner;
    uint256 public tokenSupply;
    uint256 public firstTokenId;

    function setUp() public {
        owner = address(1);
        nft = new WeekInEthereumNews(owner);
        firstTokenId = 1;
        tokenSupply = 433;
    }

    function test_Metadata() public view {
        assertEq(nft.name(), "Week in Ethereum News");
        assertEq(nft.symbol(), "WiEN");
        assertEq(nft.totalSupply(), tokenSupply);
    }

    function test_Owner() public view {
        assertEq(nft.owner(), owner);
    }

    function testFuzz_OwnerOf(uint256 tokenId) public view {
        vm.assume(tokenId >= firstTokenId && tokenId <= tokenSupply);
        assertEq(nft.ownerOf(tokenId), owner);
    }

    function testFuzz_TokenURI(uint256 tokenId) public view {
        vm.assume(tokenId >= firstTokenId && tokenId <= tokenSupply);
        assertEq(nft.tokenURI(tokenId), string.concat("ipfs://[CID]/", Strings.toString(tokenId), ".json"));
    }

    function testFuzz_OwnerOf_NonexistentToken(uint256 nonexistentTokenId) public {
        vm.assume(nonexistentTokenId < firstTokenId || nonexistentTokenId > tokenSupply);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                nonexistentTokenId
            )
        );
        nft.ownerOf(nonexistentTokenId);
    }

    function testFuzz_TokenURI_NonexistentToken(uint256 nonexistentTokenId) public {
        vm.assume(nonexistentTokenId < firstTokenId || nonexistentTokenId > tokenSupply);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                nonexistentTokenId
            )
        );
        nft.tokenURI(nonexistentTokenId);
    }
}
