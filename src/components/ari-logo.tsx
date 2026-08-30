type AriLogoProps = {
    variant?: "symbol" | "full";
    size?: number;
};

export default function AriLogo({
    variant = "symbol",
    size = 48,
}: AriLogoProps) {
    const src =
        variant === "full"
            ? "/ari-logo.png"
            : "/ari-symbol.png";

    return (
        <img
            src={src}
            alt="ARI"
            width={size}
            height={size}
            className="object-contain"
        />
    );
}