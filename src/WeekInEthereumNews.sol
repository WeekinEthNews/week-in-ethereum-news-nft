// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Consecutive} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Consecutive.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WeekInEthereumNews is
    ERC721,
    ERC721URIStorage,
    ERC721Consecutive,
    Ownable
{
    uint256 public totalSupply;

    // TODO: Add ERC-7572 contract metadata

    constructor(
        address initialOwner
    ) ERC721("Week in Ethereum News", "WiEN") Ownable(initialOwner) {
        _mintConsecutive(initialOwner, 433);
        totalSupply = 433;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://[CID]/";
    }

    // The following functions are overrides required by Solidity.

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return string.concat(super.tokenURI(tokenId), ".json");
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override(ERC721, ERC721Consecutive) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _ownerOf(
        uint256 tokenId
    )
        internal
        view
        virtual
        override(ERC721, ERC721Consecutive)
        returns (address)
    {
        return super._ownerOf(tokenId);
    }
}
