interface SealProps {
  className?: string;
}

export default function Seal({ className = "h-9 w-9" }: SealProps) {
  return (
    <img
      src="/scs-logo.png"
      alt="School of Computer Studies seal"
      className={`${className} shrink-0 object-contain`}
      draggable={false}
    />
  );
}
