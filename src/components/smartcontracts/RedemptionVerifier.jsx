// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  RedemptionVerifier
 * @notice Mooadon x Chainlink CRE — On-chain proof registry for verified coupon redemptions.
 *
 * @dev    Deploy on Avalanche Fuji Testnet (chainId: 43113)
 *         Compiler: 0.8.19, EVM: Paris, Optimiser: enabled 200 runs
 *
 * Flow:
 *   1. Chainlink CRE nodes call executeRedeemVerification (off-chain) → reach consensus on proof_hash
 *   2. CRE writes result to this contract via recordVerification()
 *   3. Anyone can verify a redemption on-chain via getVerification()
 *
 * Owner:  Mooadon treasury wallet — 0xFA9b000dF91BfAC4925151070018aE8A13C52a38
 */

contract RedemptionVerifier {

    // ── Storage ───────────────────────────────────────────────────────────────

    address public owner;

    struct Verification {
        bytes32  proofHash;       // SHA-256 / keccak256 of deterministic payload
        bool     verified;        // true = coupon valid, false = rejected
        string   reasonCode;      // e.g. "COUPON_VALID", "COUPON_EXPIRED", "ALREADY_REDEEMED"
        uint256  timestamp;       // block.timestamp at recording
        string   companyId;       // Base44 company_id (off-chain reference)
        string   couponCode;      // coupon code redeemed
        string   receiptId;       // POS receipt_id (idempotency anchor)
        bool     exists;          // sentinel for existence check
    }

    // verificationId → Verification
    mapping(string => Verification) private _verifications;

    // companyId → list of verificationIds (for enumeration)
    mapping(string => string[]) private _companyVerifications;

    // Total count
    uint256 public totalVerifications;

    // ── Events ────────────────────────────────────────────────────────────────

    event VerificationRecorded(
        string  indexed verificationId,
        string  indexed companyId,
        bytes32         proofHash,
        bool            verified,
        string          reasonCode,
        uint256         timestamp
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "RedemptionVerifier: caller is not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) {
        require(_owner != address(0), "RedemptionVerifier: zero address");
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    // ── Core: Write ───────────────────────────────────────────────────────────

    /**
     * @notice Record a CRE-verified redemption result on-chain.
     * @dev    Called by Chainlink CRE after consensus is reached off-chain.
     *         Idempotent: reverts if verificationId already recorded.
     */
    function recordVerification(
        string  calldata verificationId,
        bytes32          proofHash,
        bool             verified,
        string  calldata reasonCode,
        string  calldata companyId,
        string  calldata couponCode,
        string  calldata receiptId
    ) external onlyOwner {
        require(bytes(verificationId).length > 0, "RedemptionVerifier: empty verificationId");
        require(!_verifications[verificationId].exists, "RedemptionVerifier: already recorded");

        _verifications[verificationId] = Verification({
            proofHash:  proofHash,
            verified:   verified,
            reasonCode: reasonCode,
            timestamp:  block.timestamp,
            companyId:  companyId,
            couponCode: couponCode,
            receiptId:  receiptId,
            exists:     true
        });

        _companyVerifications[companyId].push(verificationId);
        totalVerifications++;

        emit VerificationRecorded(
            verificationId,
            companyId,
            proofHash,
            verified,
            reasonCode,
            block.timestamp
        );
    }

    // ── Core: Read ────────────────────────────────────────────────────────────

    function getVerification(string calldata verificationId)
        external
        view
        returns (
            bytes32  proofHash,
            bool     verified,
            string   memory reasonCode,
            uint256  timestamp,
            string   memory companyId,
            string   memory couponCode,
            string   memory receiptId,
            bool     exists
        )
    {
        Verification storage v = _verifications[verificationId];
        return (
            v.proofHash,
            v.verified,
            v.reasonCode,
            v.timestamp,
            v.companyId,
            v.couponCode,
            v.receiptId,
            v.exists
        );
    }

    function isRecorded(string calldata verificationId) external view returns (bool) {
        return _verifications[verificationId].exists;
    }

    function getCompanyVerifications(string calldata companyId)
        external
        view
        returns (string[] memory)
    {
        return _companyVerifications[companyId];
    }

    function getCompanyVerificationCount(string calldata companyId)
        external
        view
        returns (uint256)
    {
        return _companyVerifications[companyId].length;
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "RedemptionVerifier: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}