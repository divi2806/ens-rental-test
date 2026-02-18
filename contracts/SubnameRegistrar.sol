// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title SubnameRegistrar
 * @dev Rent/Sell ENS subdomains using Name Wrapper - Upgradeable via UUPS
 * Based on: https://docs.ens.domains/wrapper/creating-subname-registrar
 * 
 * Example: You own divicompany.eth
 * Alice rents alice.divicompany.eth for 1 year
 * - Alice gets full control during rental period
 * - You retain ownership of divicompany.eth
 * - Alice's subdomain is an ERC-1155 NFT
 * - Guaranteed ownership via CANNOT_UNWRAP fuse
 */

interface INameWrapper {
    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);
    
    function setChildFuses(
        bytes32 parentNode,
        bytes32 labelhash,
        uint32 fuses,
        uint64 expiry
    ) external;
    
    function ownerOf(uint256 tokenId) external view returns (address);
    
    function getData(uint256 tokenId) 
        external 
        view 
        returns (address owner, uint32 fuses, uint64 expiry);
}

contract SubnameRegistrar is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // Name Wrapper contract
    INameWrapper public nameWrapper;
    
    // Your parent domain (e.g., namehash of divicompany.eth)
    bytes32 public parentNode;
    
    // Rental pricing
    uint256 public rentalPrice;
    uint256 public rentalDuration;
    
    // Fuses for subnames (guarantee rental period)
    // PARENT_CANNOT_CONTROL = 0x10000 - Parent cannot take back subdomain
    // CANNOT_UNWRAP = 0x00001 - Cannot unwrap during rental period
    uint32 public constant PARENT_CANNOT_CONTROL = 0x10000;
    uint32 public constant CANNOT_UNWRAP = 0x00001;
    
    // Track rentals
    struct Rental {
        address renter;
        uint64 expiryTime;
        bool active;
    }
    
    mapping(string => Rental) public rentals;
    
    // Events
    event SubnameRented(
        string indexed label,
        address indexed renter,
        uint64 expiryTime,
        uint256 price
    );
    
    event SubnameRenewed(
        string indexed label,
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
     * @param _nameWrapper Address of the Name Wrapper contract
     * @param _parentNode Namehash of the parent domain
     * @param _owner Contract owner address
     */
    function initialize(
        address _nameWrapper,
        bytes32 _parentNode,
        address _owner
    ) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(_owner);
        
        nameWrapper = INameWrapper(_nameWrapper);
        parentNode = _parentNode;
        rentalPrice = 0.001 ether;
        rentalDuration = 365 days;
    }
    
    /**
     * @dev Rent a subdomain
     * @param label The subdomain label (e.g., "alice" for alice.divicompany.eth)
     * @param renter The address that will own the subdomain
     */
    function rentSubname(string calldata label, address renter) external payable returns (bytes32) {
        require(bytes(label).length > 0, "Empty label");
        require(msg.value >= rentalPrice, "Insufficient payment");
        require(!rentals[label].active || block.timestamp > rentals[label].expiryTime, "Already rented");
        require(renter != address(0), "Invalid renter");
        
        // Calculate expiry
        uint64 expiryTime = uint64(block.timestamp + rentalDuration);
        
        // Set fuses: PARENT_CANNOT_CONTROL + CANNOT_UNWRAP
        // This guarantees the renter has control during the rental period
        uint32 fuses = PARENT_CANNOT_CONTROL | CANNOT_UNWRAP;
        
        // Create subdomain via Name Wrapper
        bytes32 subnameNode = nameWrapper.setSubnodeOwner(
            parentNode,
            label,
            renter,
            fuses,
            expiryTime
        );
        
        // Track rental
        rentals[label] = Rental({
            renter: renter,
            expiryTime: expiryTime,
            active: true
        });
        
        emit SubnameRented(label, renter, expiryTime, msg.value);
        
        // Refund excess payment
        if (msg.value > rentalPrice) {
            payable(msg.sender).transfer(msg.value - rentalPrice);
        }
        
        return subnameNode;
    }
    
    /**
     * @dev Renew an existing subdomain rental
     * @param label The subdomain label to renew
     */
    function renewSubname(string calldata label) external payable {
        require(rentals[label].active, "Not rented");
        require(msg.sender == rentals[label].renter, "Not the renter");
        require(msg.value >= rentalPrice, "Insufficient payment");
        
        // Extend expiry
        uint64 currentExpiry = rentals[label].expiryTime;
        uint64 newExpiry;
        
        if (block.timestamp > currentExpiry) {
            // Expired - start from now
            newExpiry = uint64(block.timestamp + rentalDuration);
        } else {
            // Active - extend from current expiry
            newExpiry = uint64(currentExpiry + rentalDuration);
        }
        
        rentals[label].expiryTime = newExpiry;
        
        // Update expiry in Name Wrapper
        bytes32 labelhash = keccak256(bytes(label));
        nameWrapper.setChildFuses(
            parentNode,
            labelhash,
            PARENT_CANNOT_CONTROL | CANNOT_UNWRAP,
            newExpiry
        );
        
        emit SubnameRenewed(label, msg.sender, newExpiry);
        
        // Refund excess
        if (msg.value > rentalPrice) {
            payable(msg.sender).transfer(msg.value - rentalPrice);
        }
    }
    
    /**
     * @dev Check if a subdomain is available for rent
     */
    function isAvailable(string calldata label) external view returns (bool) {
        if (!rentals[label].active) {
            return true;
        }
        return block.timestamp > rentals[label].expiryTime;
    }
    
    /**
     * @dev Get rental info for a subdomain
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
     * @dev Update rental price (owner only)
     */
    function updatePrice(uint256 newPrice) external onlyOwner {
        rentalPrice = newPrice;
        emit PriceUpdated(newPrice);
    }
    
    /**
     * @dev Update rental duration (owner only)
     */
    function updateDuration(uint256 newDuration) external onlyOwner {
        rentalDuration = newDuration;
    }
    
    /**
     * @dev Withdraw collected rental fees (owner only)
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
