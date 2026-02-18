// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title SubnameRegistrarDirect
 * @dev Rent ENS subdomains using direct ENS Registry (no wrapping needed) - Upgradeable via UUPS
 * Works with domains owned directly in ENS Registry
 * 
 * Example: You own divi.eth
 * Alice rents alice.divi.eth for 1 year
 */

interface IENSRegistry {
    function setSubnodeOwner(
        bytes32 node,
        bytes32 label,
        address owner
    ) external returns (bytes32);
    
    function owner(bytes32 node) external view returns (address);
    function setOwner(bytes32 node, address owner) external;
    function setResolver(bytes32 node, address resolver) external;
}

interface IResolver {
    function setAddr(bytes32 node, address addr) external;
}

contract SubnameRegistrarDirect is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    IENSRegistry public ensRegistry;
    IResolver public resolver;
    bytes32 public parentNode;
    
    // Rental pricing
    uint256 public rentalPrice;
    uint256 public rentalDuration;
    
    // Track rentals
    struct Rental {
        address renter;
        uint64 expiryTime;
        bool active;
    }
    
    mapping(string => Rental) public rentals;
    mapping(bytes32 => string) public nodeToLabel; // Track label for each node
    
    event SubnameRented(
        string indexed label,
        bytes32 indexed node,
        address indexed renter,
        uint64 expiryTime,
        uint256 price
    );
    
    event SubnameRenewed(
        string indexed label,
        bytes32 indexed node,
        address indexed renter,
        uint64 newExpiry
    );
    
    event PriceUpdated(uint256 newPrice);
    event FundsWithdrawn(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract (replaces constructor for upgradeable pattern)
     * @param _ensRegistry Address of the ENS Registry contract
     * @param _resolver Address of the resolver contract
     * @param _parentNode Namehash of the parent domain
     * @param _owner Contract owner address
     */
    function initialize(
        address _ensRegistry,
        address _resolver,
        bytes32 _parentNode,
        address _owner
    ) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(_owner);
        
        ensRegistry = IENSRegistry(_ensRegistry);
        resolver = IResolver(_resolver);
        parentNode = _parentNode;
        rentalPrice = 0.001 ether;
        rentalDuration = 365 days;
    }
    
    /**
     * @dev Rent a subdomain
     */
    function rentSubname(string calldata label, address renter) external payable returns (bytes32) {
        require(bytes(label).length > 0, "Empty label");
        require(msg.value >= rentalPrice, "Insufficient payment");
        require(!rentals[label].active || block.timestamp > rentals[label].expiryTime, "Already rented");
        require(renter != address(0), "Invalid renter");
        
        bytes32 labelHash = keccak256(bytes(label));
        uint64 expiryTime = uint64(block.timestamp + rentalDuration);
        
        // Create subdomain
        bytes32 subnameNode = ensRegistry.setSubnodeOwner(
            parentNode,
            labelHash,
            renter
        );
        
        // Set resolver
        try resolver.setAddr(subnameNode, renter) {} catch {}
        
        // Track rental
        rentals[label] = Rental({
            renter: renter,
            expiryTime: expiryTime,
            active: true
        });
        
        nodeToLabel[subnameNode] = label;
        
        emit SubnameRented(label, subnameNode, renter, expiryTime, msg.value);
        
        // Refund excess
        if (msg.value > rentalPrice) {
            payable(msg.sender).transfer(msg.value - rentalPrice);
        }
        
        return subnameNode;
    }
    
    /**
     * @dev Renew rental
     */
    function renewSubname(string calldata label) external payable {
        require(rentals[label].active, "Not rented");
        require(msg.sender == rentals[label].renter, "Not the renter");
        require(msg.value >= rentalPrice, "Insufficient payment");
        
        uint64 currentExpiry = rentals[label].expiryTime;
        uint64 newExpiry;
        
        if (block.timestamp > currentExpiry) {
            newExpiry = uint64(block.timestamp + rentalDuration);
        } else {
            newExpiry = uint64(currentExpiry + rentalDuration);
        }
        
        rentals[label].expiryTime = newExpiry;
        
        bytes32 labelHash = keccak256(bytes(label));
        bytes32 subnameNode = keccak256(abi.encodePacked(parentNode, labelHash));
        
        emit SubnameRenewed(label, subnameNode, msg.sender, newExpiry);
        
        if (msg.value > rentalPrice) {
            payable(msg.sender).transfer(msg.value - rentalPrice);
        }
    }
    
    /**
     * @dev Reclaim expired subdomain
     */
    function reclaimExpired(string calldata label) external onlyOwner {
        require(rentals[label].active, "Not rented");
        require(block.timestamp > rentals[label].expiryTime, "Not expired");
        
        bytes32 labelHash = keccak256(bytes(label));
        
        // Reset ownership to contract
        ensRegistry.setSubnodeOwner(parentNode, labelHash, address(this));
        
        rentals[label].active = false;
    }
    
    /**
     * @dev Check if available
     */
    function isAvailable(string calldata label) external view returns (bool) {
        if (!rentals[label].active) {
            return true;
        }
        return block.timestamp > rentals[label].expiryTime;
    }
    
    /**
     * @dev Get rental info
     */
    function getRentalInfo(string calldata label) 
        external 
        view 
        returns (address renter, uint64 expiryTime, bool active) 
    {
        Rental memory rental = rentals[label];
        return (rental.renter, rental.expiryTime, rental.active);
    }
    
    /**
     * @dev Update price
     */
    function updatePrice(uint256 newPrice) external onlyOwner {
        rentalPrice = newPrice;
        emit PriceUpdated(newPrice);
    }
    
    /**
     * @dev Update duration
     */
    function updateDuration(uint256 newDuration) external onlyOwner {
        rentalDuration = newDuration;
    }
    
    /**
     * @dev Withdraw fees
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        
        payable(owner()).transfer(balance);
        emit FundsWithdrawn(owner(), balance);
    }

    /**
     * @dev Function that authorizes an upgrade to a new implementation
     * Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    receive() external payable {}
}
