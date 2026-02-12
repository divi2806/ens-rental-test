// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title OffchainResolver
 * @dev ENSIP-10 wildcard resolver using CCIP-Read (ERC-3668)
 *
 * When ENS resolves a name like `1.test.divicompany.eth`, the resolver
 * reverts with OffchainLookup, directing the client to a gateway.
 * The gateway returns signed data, which is verified on-chain via resolveWithProof.
 *
 * Signing scheme matches SignatureVerifier.sol:
 *   toEthSignedMessageHash(keccak256(encodePacked(0x1900, sender, expires, keccak256(request), keccak256(result))))
 */

interface IExtendedResolver {
    function resolve(bytes memory name, bytes memory data) external view returns (bytes memory);
}

contract OffchainResolver is IExtendedResolver, ERC165 {
    // Gateway URL template (CCIP-Read standard: {sender} and {data} are replaced by client)
    string public url;

    // Approved signers whose gateway responses are trusted
    mapping(address => bool) public signers;

    // Contract owner
    address public owner;

    // ERC-3668: OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    event SignerUpdated(address indexed signer, bool approved);
    event UrlUpdated(string newUrl);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(string memory _url, address _signer) {
        url = _url;
        owner = msg.sender;
        signers[_signer] = true;
        emit SignerUpdated(_signer, true);
    }

    /**
     * @dev ENSIP-10 resolve — always reverts with OffchainLookup to direct clients to gateway
     */
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        override
        returns (bytes memory)
    {
        bytes memory callData = abi.encodeWithSelector(
            IExtendedResolver.resolve.selector,
            name,
            data
        );

        string[] memory urls = new string[](1);
        urls[0] = url;

        revert OffchainLookup(
            address(this),
            urls,
            callData,
            this.resolveWithProof.selector,
            abi.encode(callData, address(this))
        );
    }

    /**
     * @dev Callback for CCIP-Read. Verifies the gateway's signed response.
     * @param response ABI-encoded (bytes result, uint64 expires, bytes signature)
     * @param extraData ABI-encoded (bytes request, address sender) from OffchainLookup
     */
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (bytes memory result, uint64 expires, bytes memory sig) =
            abi.decode(response, (bytes, uint64, bytes));

        (bytes memory request, address sender) =
            abi.decode(extraData, (bytes, address));

        // Build the same message hash the gateway signs
        bytes32 messageHash = makeSignatureHash(sender, expires, request, result);

        // Recover signer
        address signer = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(messageHash),
            sig
        );

        // Verify signer is approved
        require(signers[signer], "Invalid signer");

        // Verify not expired
        require(expires >= block.timestamp, "Signature expired");

        return result;
    }

    /**
     * @dev Builds the message hash matching SignatureVerifier.sol exactly:
     *      keccak256(encodePacked(0x1900, target, expires, keccak256(request), keccak256(result)))
     */
    function makeSignatureHash(
        address target,
        uint64 expires,
        bytes memory request,
        bytes memory result
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                hex"1900",
                target,
                expires,
                keccak256(request),
                keccak256(result)
            )
        );
    }

    // --- Admin functions ---

    function setUrl(string calldata _url) external onlyOwner {
        url = _url;
        emit UrlUpdated(_url);
    }

    function setSigner(address _signer, bool _approved) external onlyOwner {
        signers[_signer] = _approved;
        emit SignerUpdated(_signer, _approved);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // --- ERC-165 ---

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return
            interfaceId == type(IExtendedResolver).interfaceId || // 0x9061b923
            super.supportsInterface(interfaceId);
    }
}
