/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AboutProject from './pages/AboutProject';
import AICampaigns from './pages/AICampaigns';
import APIDocumentation from './pages/APIDocumentation';
import APIOnboarding from './pages/APIOnboarding';
import AdminMintTool from './pages/AdminMintTool';
import AdminStoreManagement from './pages/AdminStoreManagement';
import AgentDashboard from './pages/AgentDashboard';
import AutomationRules from './pages/AutomationRules';
import AutomationSettings from './pages/AutomationSettings';
import AvalancheCopilot from './pages/AvalancheCopilot';
import BlockchainTesting from './pages/BlockchainTesting';
import BlockchainTransactions from './pages/BlockchainTransactions';
import Branches from './pages/Branches';
import BrandVoiceSettings from './pages/BrandVoiceSettings';
import BusinessAIStudio from './pages/BusinessAIStudio';
import BusinessCustomersDashboard from './pages/BusinessCustomersDashboard';
import CRMStatus from './pages/CRMStatus';
import CampaignROI from './pages/CampaignROI';
import CashPoolManagement from './pages/CashPoolManagement';
import ClaimReward from './pages/ClaimReward';
import ClientDetails from './pages/ClientDetails';
import ClientOnboarding from './pages/ClientOnboarding';
import ClientPortal from './pages/ClientPortal';
import ClientStaking from './pages/ClientStaking';
import ClientWalletPage from './pages/ClientWalletPage';
import Clients from './pages/Clients';
import Companies from './pages/Companies';
import CompanyRegistration from './pages/CompanyRegistration';
import CompanyRepairTool from './pages/CompanyRepairTool';
import CompanySettings from './pages/CompanySettings';
import CompanySetupMonitor from './pages/CompanySetupMonitor';
import ConnectCRM from './pages/ConnectCRM';
import ConnectSalesChannel from './pages/ConnectSalesChannel';
import ConnectWizard from './pages/ConnectWizard';
import CouponDisplay from './pages/CouponDisplay';
import CouponPage from './pages/CouponPage';
import Coupons from './pages/Coupons';
import CrossChainRedemption from './pages/CrossChainRedemption';
import CustomerAIInsights from './pages/CustomerAIInsights';
import IntegrationsDashboard from './pages/IntegrationsDashboard';
import LandingPage from './pages/LandingPage';
import LedgerEvents from './pages/LedgerEvents';
import MigrationCenter from './pages/MigrationCenter';
import MooadonAdmin from './pages/MooadonAdmin';
import MooadonTouchMenu from './pages/MooadonTouchMenu';
import OnboardingWizard from './pages/OnboardingWizard';
import OnchainActivityDashboard from './pages/OnchainActivityDashboard';
import OnlinePOSWizard from './pages/OnlinePOSWizard';
import POSConnect from './pages/POSConnect';
import POSIntegrationHub from './pages/POSIntegrationHub';
import POSTerminal from './pages/POSTerminal';
import PaymentHistory from './pages/PaymentHistory';
import ProductsAdmin from './pages/ProductsAdmin';
import PublicStorefront from './pages/PublicStorefront';
import RewardQueueStatus from './pages/RewardQueueStatus';
import RewardsStore from './pages/RewardsStore';
import SettlementDashboard from './pages/SettlementDashboard';
import SocialMarketing from './pages/SocialMarketing';
import SpendQRPage from './pages/SpendQRPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import TokenManagement from './pages/TokenManagement';
import Transactions from './pages/Transactions';
import TransactionsAndSettlement from './pages/TransactionsAndSettlement';
import UserPermissionsManagement from './pages/UserPermissionsManagement';
import UserWalletManagement from './pages/UserWalletManagement';
import WalletStore from './pages/WalletStore';
import WalletStoreOrders from './pages/WalletStoreOrders';
import Web3Hub from './pages/Web3Hub';
import WebhookSettings from './pages/WebhookSettings';
import ZapierIntegration from './pages/ZapierIntegration';
import ZetaChainBridges from './pages/ZetaChainBridges';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AboutProject": AboutProject,
    "AICampaigns": AICampaigns,
    "APIDocumentation": APIDocumentation,
    "APIOnboarding": APIOnboarding,
    "AdminMintTool": AdminMintTool,
    "AdminStoreManagement": AdminStoreManagement,
    "AgentDashboard": AgentDashboard,
    "AutomationRules": AutomationRules,
    "AutomationSettings": AutomationSettings,
    "AvalancheCopilot": AvalancheCopilot,
    "BlockchainTesting": BlockchainTesting,
    "BlockchainTransactions": BlockchainTransactions,
    "Branches": Branches,
    "BrandVoiceSettings": BrandVoiceSettings,
    "BusinessAIStudio": BusinessAIStudio,
    "BusinessCustomersDashboard": BusinessCustomersDashboard,
    "CRMStatus": CRMStatus,
    "CampaignROI": CampaignROI,
    "CashPoolManagement": CashPoolManagement,
    "ClaimReward": ClaimReward,
    "ClientDetails": ClientDetails,
    "ClientOnboarding": ClientOnboarding,
    "ClientPortal": ClientPortal,
    "ClientStaking": ClientStaking,
    "ClientWalletPage": ClientWalletPage,
    "Clients": Clients,
    "Companies": Companies,
    "CompanyRegistration": CompanyRegistration,
    "CompanyRepairTool": CompanyRepairTool,
    "CompanySettings": CompanySettings,
    "CompanySetupMonitor": CompanySetupMonitor,
    "ConnectCRM": ConnectCRM,
    "ConnectSalesChannel": ConnectSalesChannel,
    "ConnectWizard": ConnectWizard,
    "CouponDisplay": CouponDisplay,
    "CouponPage": CouponPage,
    "Coupons": Coupons,
    "CrossChainRedemption": CrossChainRedemption,
    "CustomerAIInsights": CustomerAIInsights,
    "IntegrationsDashboard": IntegrationsDashboard,
    "LandingPage": LandingPage,
    "LedgerEvents": LedgerEvents,
    "MigrationCenter": MigrationCenter,
    "MooadonAdmin": MooadonAdmin,
    "MooadonTouchMenu": MooadonTouchMenu,
    "OnboardingWizard": OnboardingWizard,
    "OnchainActivityDashboard": OnchainActivityDashboard,
    "OnlinePOSWizard": OnlinePOSWizard,
    "POSConnect": POSConnect,
    "POSIntegrationHub": POSIntegrationHub,
    "POSTerminal": POSTerminal,
    "PaymentHistory": PaymentHistory,
    "ProductsAdmin": ProductsAdmin,
    "PublicStorefront": PublicStorefront,
    "RewardQueueStatus": RewardQueueStatus,
    "RewardsStore": RewardsStore,
    "SettlementDashboard": SettlementDashboard,
    "SocialMarketing": SocialMarketing,
    "SpendQRPage": SpendQRPage,
    "SuperAdminDashboard": SuperAdminDashboard,
    "TokenManagement": TokenManagement,
    "Transactions": Transactions,
    "TransactionsAndSettlement": TransactionsAndSettlement,
    "UserPermissionsManagement": UserPermissionsManagement,
    "UserWalletManagement": UserWalletManagement,
    "WalletStore": WalletStore,
    "WalletStoreOrders": WalletStoreOrders,
    "Web3Hub": Web3Hub,
    "WebhookSettings": WebhookSettings,
    "ZapierIntegration": ZapierIntegration,
    "ZetaChainBridges": ZetaChainBridges,
}

export const pagesConfig = {
    mainPage: "AgentDashboard",
    Pages: PAGES,
    Layout: __Layout,
};