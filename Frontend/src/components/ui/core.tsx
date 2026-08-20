import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================
// BUTTON COMPONENT
// ========================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyle = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
    
    const variants = {
      primary: "gradient-bg text-white hover:opacity-95 shadow-md shadow-primary/20",
      secondary: "bg-secondary text-white hover:bg-secondary/90 shadow-md shadow-secondary/15",
      accent: "bg-accent text-text hover:bg-accent/90 shadow-md shadow-accent/10",
      outline: "border border-border bg-transparent text-text hover:bg-border/30",
      ghost: "bg-transparent text-text hover:bg-border/30",
      danger: "bg-danger text-white hover:bg-danger/90 shadow-md shadow-danger/10",
      success: "bg-success text-white hover:bg-success/90 shadow-md shadow-success/10",
      warning: "bg-warning text-text hover:bg-warning/90 shadow-md shadow-warning/10",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs rounded-button",
      md: "px-5 py-2.5 text-sm rounded-button",
      lg: "px-7 py-3 text-base rounded-button",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyle, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ========================
// INPUT COMPONENT
// ========================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-xs font-semibold text-text/80">{label}</label>}
        <input
          ref={ref}
          type={type}
          className={cn(
            "w-full px-4 py-3 bg-white border border-border text-sm placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all rounded-input outline-none",
            error && "border-danger focus:ring-danger/10",
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-danger font-medium mt-0.5">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ========================
// CARD COMPONENT
// ========================
export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-card border border-border/60 rounded-card card-shadow overflow-hidden transition-all duration-300", className)} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pb-4 flex flex-col gap-1.5", className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-bold leading-none tracking-tight text-text", className)} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-xs text-text-secondary", className)} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0 border-t border-border/40 mt-4 flex items-center justify-end gap-2", className)} {...props}>
    {children}
  </div>
);

// ========================
// BADGE COMPONENT
// ========================
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'outline';
}

export const Badge = ({ className, variant = 'primary', ...props }: BadgeProps) => {
  const styles = {
    primary: "bg-primary/10 text-primary border border-primary/20",
    secondary: "bg-secondary/10 text-secondary border border-secondary/20",
    accent: "bg-accent/10 text-accent border border-accent/20",
    success: "bg-success/10 text-success border border-success/20",
    danger: "bg-danger/10 text-danger border border-danger/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    info: "bg-info/10 text-info border border-info/20",
    outline: "border border-border text-text-secondary"
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide", styles[variant], className)} {...props} />
  );
};

// ========================
// PROGRESS COMPONENT
// ========================
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  colorClass?: string;
}

export const Progress = ({ className, value, colorClass = "gradient-bg", ...props }: ProgressProps) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  return (
    <div className={cn("h-2.5 w-full bg-border/40 rounded-full overflow-hidden", className)} {...props}>
      <motion.div
        className={cn("h-full rounded-full", colorClass)}
        initial={{ width: 0 }}
        animate={{ width: `${clampedValue}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
};

// ========================
// TABS COMPONENTS
// ========================
interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  children: React.ReactNode;
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

const TabsContext = React.createContext<{
  selectedValue: string;
  setSelectedValue: (val: string) => void;
} | null>(null);

export const Tabs = ({ defaultValue, children, className, ...props }: TabsProps) => {
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ selectedValue, setSelectedValue }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className, ...props }: TabsListProps) => {
  return (
    <div className={cn("flex bg-border/30 p-1 rounded-[16px] gap-1", className)} {...props}>
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className, ...props }: TabsTriggerProps) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  const isActive = ctx.selectedValue === value;

  return (
    <button
      type="button"
      className={cn(
        "flex-1 text-center py-2 text-sm font-semibold rounded-[12px] transition-all relative overflow-hidden",
        isActive ? "bg-white text-primary shadow-sm" : "text-text-secondary hover:text-text hover:bg-white/40",
        className
      )}
      onClick={() => ctx.setSelectedValue(value)}
      {...props}
    >
      {isActive && (
        <motion.div
          layoutId="activeTabOutline"
          className="absolute inset-0 bg-white shadow-sm rounded-[12px] -z-10"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className, ...props }: TabsContentProps) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx || ctx.selectedValue !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn("mt-4", className)}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
};

// ========================
// ACCORDION (FOR FAQ)
// ========================
interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpenDefault?: boolean;
}

export const Accordion = ({ children, className }: AccordionProps) => {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {children}
    </div>
  );
};

export const AccordionItem = ({ title, children, isOpenDefault = false }: AccordionItemProps) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  return (
    <div className="border border-border/50 bg-white rounded-card overflow-hidden transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
      <button
        type="button"
        className="w-full flex items-center justify-between p-5 font-semibold text-left text-sm md:text-base text-text hover:bg-border/10 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-text-secondary" />
        </motion.div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="p-5 pt-0 text-sm leading-relaxed text-text-secondary border-t border-border/20">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ========================
// DIALOG (MODAL)
// ========================
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Dialog = ({ isOpen, onClose, children, className }: DialogProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className={cn("bg-card w-full max-w-lg rounded-card shadow-xl overflow-hidden border border-border relative z-10 flex flex-col", className)}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-border/30 text-text-secondary hover:text-text transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const DialogHeader = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pb-4 border-b border-border/40", className)}>{children}</div>
);

export const DialogTitle = ({ children, className }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-bold text-text", className)}>{children}</h2>
);

export const DialogContent = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 overflow-y-auto max-h-[70vh]", className)}>{children}</div>
);

// ========================
// DROPDOWN COMPONENT
// ========================
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

export const Dropdown = ({ trigger, children, align = 'right' }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-30 mt-2 w-56 rounded-[16px] bg-white p-1.5 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border",
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            <div onClick={() => setIsOpen(false)}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DropdownItem = ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center px-3 py-2 text-sm font-medium text-text rounded-[10px] hover:bg-border/30 hover:text-primary transition-colors text-left",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

// ========================
// AVATAR COMPONENT
// ========================
interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar = ({ src, name, size = 'md', className }: AvatarProps) => {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg font-bold"
  };

  return (
    <div className={cn("relative flex shrink-0 overflow-hidden rounded-full border border-border bg-orange-100 text-primary font-semibold items-center justify-center", sizes[size], className)}>
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

// ========================
// TABLE COMPONENTS
// ========================
export const TableContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("w-full overflow-x-auto rounded-card border border-border bg-white shadow-[0_4px_20px_rgba(0,0,0,0.02)]", className)}>
    <table className="w-full text-left border-collapse min-w-[700px]">
      {children}
    </table>
  </div>
);

export const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-border/20 border-b border-border/40 text-text-secondary font-bold text-xs uppercase tracking-wider">
    {children}
  </thead>
);

export const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="divide-y divide-border/30 text-sm text-text">
    {children}
  </tbody>
);

export const TableRow = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <tr 
    onClick={onClick}
    className={cn(
      "transition-colors hover:bg-border/10", 
      onClick && "cursor-pointer", 
      className
    )}
  >
    {children}
  </tr>
);

export const TableHead = ({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("p-4 font-semibold text-text-secondary", className)} {...props}>{children}</th>
);

export const TableCell = ({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("p-4 align-middle", className)} {...props}>{children}</td>
);

// ========================
// DATE PICKER / CALENDAR
// ========================
interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

export const DatePicker = ({ value, onChange, label }: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-1 w-full relative" ref={containerRef}>
      {label && <label className="text-xs font-semibold text-text/80">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-border text-sm rounded-input text-left hover:bg-border/10 transition-colors"
      >
        <span className={value ? "text-text" : "text-text-secondary"}>
          {value ? value : "Chọn ngày..."}
        </span>
        <CalendarIcon className="h-4 w-4 text-text-secondary" />
      </button>

      {isOpen && (
        <div className="absolute z-30 top-full mt-2 left-0 bg-white p-3 border border-border shadow-lg rounded-card">
          <input
            type="date"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(false);
            }}
            className="w-full p-2 border border-border rounded-input outline-none focus:border-primary text-sm"
          />
        </div>
      )}
    </div>
  );
};
