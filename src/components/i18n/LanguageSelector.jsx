import React from 'react';
import { useI18n } from './useI18n';
import { LANGUAGES } from './translations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LanguageSelector() {
  const { language, setLanguage, currentLang } = useI18n();

  const handleLanguageChange = async (langCode) => {
    setLanguage(langCode);
    
    // Update user language preference in database
    try {
      const user = await base44.auth.me();
      if (user) {
        await base44.auth.updateMe({ language: langCode });
      }
    } catch (error) {
      console.log('Could not save language preference:', error);
    }
    
    // Reload to apply RTL/LTR changes
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-white hover:text-white">
          <Globe className="w-4 h-4 text-white" />
          <span className="text-xs">{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#1f2128] border-[#2d2d3a]">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`gap-2 text-white hover:bg-[#17171f] ${
              language === lang.code ? 'bg-[#17171f]' : ''
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}