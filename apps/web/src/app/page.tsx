import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Great_Vibes, Nunito, Oswald } from "next/font/google";

// Landing page pública da Clínica Girassóis (design: autismCAD-handoff.zip →
// "Clinica Girassois - Landing Page.dc.html"). O dashboard interno mora em /dashboard.

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600"] });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], style: ["normal", "italic"] });

const WA_HREF = "https://wa.me/556536222826";
const TELEFONE = "(65) 3622-2826";
const EMAIL = "girassoisclinica@gmail.com";
const MAPS_EMBED =
  "https://www.google.com/maps?q=Av.+Portugal,+337+-+Jardim+Tropical,+Cuiab%C3%A1+-+MT,+78065-145&output=embed";

export const metadata: Metadata = {
  title: "Clínica Girassóis — Terapia infantil multidisciplinar em Cuiabá",
  description:
    "Clínica especializada em Terapia ABA / Modelo Denver, intervenção precoce no autismo e psicoterapia infanto-juvenil em Cuiabá – MT.",
};

function Girassol({ size, style }: { size: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block", ...style }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#2BA52E"
        d="M425.273 383.185c-.04-.679-.038-1.3-.129-1.855l-.276-1.452c-.339-1.741-.597-2.71-.597-2.71a3.1 3.1 0 0 0-4.081-2.107s-.938.351-2.554 1.082c-1.673.886-3.827 1.46-6.502 2.393a70.25 70.25 0 0 1-9.159 2.33c-3.33.612-6.85.957-10.468 1.069c-3.631.114-7.342.037-11.303-.104a770.812 770.812 0 0 0-12.697-.414a273.164 273.164 0 0 0-14.642-.007c-5.208.153-10.802.454-16.672 1.088c-5.884.611-12.08 1.56-18.531 3.086c-6.452 1.551-13.16 3.656-19.985 6.735c-6.606 2.983-13.369 6.953-19.53 12.191v-93.184c0-12.23-9.915-22.146-22.146-22.146s-22.146 9.915-22.146 22.146v93.763l-.023-.021c-6.273-5.49-13.23-9.62-20.012-12.704c-6.814-3.095-13.512-5.211-19.946-6.767c-6.433-1.532-12.606-2.484-18.465-3.096c-5.842-.635-11.411-.938-16.585-1.092a267.674 267.674 0 0 0-14.547.005c-4.525.108-8.649.252-12.609.413c-3.93.137-7.627.216-11.242.1c-3.604-.114-7.115-.463-10.436-1.077a70.691 70.691 0 0 1-9.139-2.329c-2.666-.927-4.822-1.505-6.491-2.383c-1.613-.727-2.55-1.075-2.55-1.075a3.106 3.106 0 0 0-4.081 2.107s-.259.965-.602 2.701l-.278 1.448c-.095.551-.092 1.171-.135 1.847l-.071 2.221c-.006.819.046 1.567.082 2.442c.084 3.482.795 7.643 2.336 12.352c1.553 4.687 4.088 9.837 7.709 14.867c3.604 5.03 8.271 9.927 13.613 14.221c5.327 4.282 11.327 8.023 17.489 11.072c6.167 3.102 12.544 5.538 18.788 7.49c6.272 1.957 12.399 3.409 18.247 4.54a187.11 187.11 0 0 0 8.498 1.464c2.718.409 5.374.748 7.878 1.017c5.012.535 9.531.835 13.329.955c3.824.115 6.875.02 9.357-.295c2.476-.288 4.49-.89 6.801-1.04c2.328-.199 4.901.342 7.479 1.571c2.56 1.215 5.003 3.006 7.035 4.777c2.05 1.755 3.722 3.441 4.912 4.634c1.172 1.197 1.909 1.886 1.909 1.886l.587.549l.116.105c.331.294.683.546 1.046.774v17.031c0 12.23 9.915 22.146 22.146 22.146s22.146-9.915 22.146-22.146v-17.694c.094-.08.191-.153.281-.238l.563-.527s.737-.691 1.909-1.892c1.191-1.196 2.863-2.887 4.918-4.642c2.036-1.77 4.48-3.56 7.047-4.76c2.577-1.22 5.158-1.73 7.488-1.528c2.315.155 4.35.746 6.872 1.022c2.518.303 5.623.39 9.491.273c3.841-.123 8.4-.423 13.446-.957c2.52-.268 5.193-.607 7.925-1.015c2.77-.405 5.605-.893 8.539-1.461c5.872-1.128 12.024-2.578 18.315-4.529c6.266-1.948 12.659-4.375 18.847-7.469c6.18-3.035 12.204-6.769 17.557-11.041c5.368-4.276 10.068-9.172 13.705-14.2c3.655-5.029 6.224-10.187 7.803-14.884c1.571-4.719 2.297-8.896 2.395-12.389c.039-.877.093-1.63.091-2.449a83.92 83.92 0 0 0-.065-2.234z"
      />
      <path
        fill="#FFB636"
        d="M434.423 175.192s-1.394-1.143-4.008-2.987a113.036 113.036 0 0 0-4.813-3.271a157.394 157.394 0 0 0-6.512-4.105c-4.145-2.491-9.051-5.224-14.598-8.034c3.931-4.818 7.307-9.307 10.085-13.265a155.863 155.863 0 0 0 4.287-6.394a113.026 113.026 0 0 0 3.073-4.942c1.641-2.746 2.451-4.356 2.451-4.356c.471-.951.903-2.042 1.196-3.104c2.483-9.001-2.801-18.31-11.802-20.794c0 0-1.738-.479-4.875-1.105a111.678 111.678 0 0 0-5.727-1.037a155.557 155.557 0 0 0-7.617-1.11c-3.16-.392-6.673-.745-10.469-1.032a221.49 221.49 0 0 0 2.8-10.141a156.026 156.026 0 0 0 1.702-7.507a112.82 112.82 0 0 0 1.091-5.717c.544-3.152.722-4.946.722-4.946c.098-1.057.108-2.23 0-3.326c-.919-9.292-9.196-16.08-18.488-15.161c0 0-1.794.177-4.946.722a112.13 112.13 0 0 0-5.717 1.091c-2.23.449-4.754 1.005-7.507 1.702c-4.693 1.169-10.094 2.706-16.004 4.642c-.628-6.186-1.414-11.747-2.249-16.51c-.48-2.799-.995-5.332-1.489-7.552a112.174 112.174 0 0 0-1.322-5.667c-.781-3.102-1.347-4.813-1.347-4.813a17.986 17.986 0 0 0-1.349-3.04c-4.609-8.12-14.928-10.967-23.048-6.358c0 0-1.568.89-4.228 2.666a112.073 112.073 0 0 0-4.783 3.316a156.548 156.548 0 0 0-6.171 4.601a221.035 221.035 0 0 0-8.133 6.673a220.56 220.56 0 0 0-5.191-9.151a156.338 156.338 0 0 0-4.105-6.512a111.766 111.766 0 0 0-3.271-4.813c-1.844-2.614-2.987-4.008-2.987-4.008a17.96 17.96 0 0 0-2.352-2.352c-7.22-5.921-17.872-4.868-23.793 2.352c0 0-1.143 1.394-2.987 4.008a112.397 112.397 0 0 0-3.271 4.813a157.394 157.394 0 0 0-4.105 6.512c-2.494 4.148-5.229 9.059-8.041 14.612c-4.819-3.934-9.308-7.313-13.267-10.093a157.861 157.861 0 0 0-6.39-4.289a112.622 112.622 0 0 0-4.94-3.074c-2.744-1.642-4.353-2.452-4.353-2.452a17.933 17.933 0 0 0-3.12-1.202c-8.998-2.477-18.301 2.809-20.778 11.807c0 0-.478 1.737-1.102 4.873c-.318 1.571-.7 3.504-1.034 5.725a155.575 155.575 0 0 0-1.107 7.616a220.1 220.1 0 0 0-1.03 10.487a220.755 220.755 0 0 0-10.158-2.809a156.007 156.007 0 0 0-7.505-1.705a113.249 113.249 0 0 0-5.714-1.093c-3.151-.546-4.944-.724-4.944-.724a17.862 17.862 0 0 0-3.343 0c-9.287.923-16.068 9.2-15.144 18.487c0 0 .178 1.793.724 4.944c.268 1.58.606 3.521 1.093 5.714c.45 2.23 1.007 4.753 1.705 7.505c1.172 4.698 2.713 10.106 4.654 16.024c-6.196.626-11.764 1.412-16.533 2.246c-2.799.479-5.331.993-7.551 1.486c-2.202.445-4.113.923-5.666 1.319c-3.101.779-4.812 1.344-4.812 1.344a17.971 17.971 0 0 0-3.056 1.356c-8.114 4.611-10.954 14.927-6.343 23.042c0 0 .89 1.567 2.667 4.225a112.314 112.314 0 0 0 3.317 4.78a156.712 156.712 0 0 0 4.602 6.168c1.961 2.515 4.2 5.252 6.687 8.144a222.178 222.178 0 0 0-9.169 5.196a157.619 157.619 0 0 0-6.512 4.101a112.641 112.641 0 0 0-4.813 3.268c-2.614 1.842-4.008 2.984-4.008 2.984a18.02 18.02 0 0 0-2.364 2.364c-5.914 7.22-4.856 17.867 2.364 23.781c0 0 1.394 1.142 4.008 2.984c1.307.928 2.919 2.061 4.813 3.268a156.56 156.56 0 0 0 6.512 4.101c4.151 2.493 9.065 5.228 14.622 8.04c-3.938 4.824-7.321 9.317-10.103 13.279a157.143 157.143 0 0 0-4.289 6.391a112.622 112.622 0 0 0-3.074 4.94c-1.642 2.744-2.452 4.353-2.452 4.353a17.933 17.933 0 0 0-1.202 3.12c-2.477 8.998 2.809 18.301 11.808 20.778c0 0 1.737.478 4.873 1.102c1.571.318 3.504.7 5.725 1.035c2.242.382 4.797.769 7.616 1.107a220.1 220.1 0 0 0 10.487 1.03a220.715 220.715 0 0 0-2.809 10.156a156.007 156.007 0 0 0-1.705 7.505a113.249 113.249 0 0 0-1.093 5.714c-.545 3.151-.724 4.944-.724 4.944a17.947 17.947 0 0 0 0 3.343c.923 9.287 9.2 16.068 18.488 15.145c0 0 1.793-.178 4.944-.724c1.58-.268 3.521-.606 5.714-1.093c2.23-.45 4.753-1.007 7.505-1.705c4.698-1.172 10.106-2.713 16.024-4.654c.626 6.196 1.412 11.765 2.246 16.535a157.05 157.05 0 0 0 1.486 7.551c.445 2.202.923 4.113 1.319 5.666c.779 3.101 1.344 4.812 1.344 4.812a17.971 17.971 0 0 0 1.356 3.056c4.611 8.114 14.927 10.954 23.042 6.343c0 0 1.567-.89 4.225-2.667a113.247 113.247 0 0 0 4.78-3.317a155.814 155.814 0 0 0 6.168-4.603a221.768 221.768 0 0 0 8.145-6.688a221.493 221.493 0 0 0 5.195 9.168a157.619 157.619 0 0 0 4.101 6.512a112.007 112.007 0 0 0 3.268 4.813c1.842 2.614 2.984 4.007 2.984 4.007a18.02 18.02 0 0 0 2.364 2.364c7.22 5.914 17.867 4.856 23.781-2.364c0 0 1.142-1.394 2.984-4.007a113.283 113.283 0 0 0 3.268-4.813a156.56 156.56 0 0 0 4.101-6.512c2.491-4.147 5.223-9.057 8.032-14.608c4.823 3.935 9.316 7.314 13.278 10.095a155.863 155.863 0 0 0 6.394 4.287a113.026 113.026 0 0 0 4.942 3.073c2.745 1.641 4.356 2.451 4.356 2.451c.952.471 2.042.903 3.104 1.196c9.001 2.483 18.311-2.801 20.794-11.802c0 0 .479-1.738 1.104-4.875c.319-1.571.701-3.504 1.037-5.727c.383-2.243.771-4.798 1.11-7.617c.392-3.16.745-6.673 1.032-10.469a221.099 221.099 0 0 0 10.139 2.8c2.753.697 5.277 1.253 7.507 1.702c2.194.485 4.135.824 5.717 1.09c3.152.544 4.946.722 4.946.722c1.057.097 2.231.108 3.326 0c9.292-.919 16.08-9.196 15.161-18.488c0 0-.177-1.794-.722-4.946a112.13 112.13 0 0 0-1.091-5.717a156.026 156.026 0 0 0-1.702-7.507c-1.169-4.693-2.706-10.094-4.642-16.003c6.187-.628 11.748-1.414 16.512-2.249c2.799-.48 5.332-.995 7.553-1.49c2.203-.446 4.114-.925 5.667-1.322c3.102-.781 4.813-1.347 4.813-1.347a17.986 17.986 0 0 0 3.04-1.349c8.12-4.609 10.967-14.928 6.358-23.048c0 0-.89-1.568-2.666-4.228a112.073 112.073 0 0 0-3.316-4.783a156.548 156.548 0 0 0-4.601-6.171a221.035 221.035 0 0 0-6.673-8.133a221.687 221.687 0 0 0 9.15-5.19a156.338 156.338 0 0 0 6.512-4.105a111.766 111.766 0 0 0 4.813-3.271c2.614-1.844 4.008-2.987 4.008-2.987a17.96 17.96 0 0 0 2.352-2.352c5.925-7.219 4.872-17.872-2.348-23.792z"
      />
      <circle fill="#68442A" cx="256" cy="188.266" r="94.684" />
    </svg>
  );
}

function WhatsIcon({ size, invert }: { size: number; invert?: boolean }) {
  const bubble = invert ? "#ffffff" : "#4caf50";
  const phone = invert ? "#4caf50" : "#ffffff";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3z" fill={bubble} />
      <path
        d="M9.2 7.6c.2-.5.5-.5.7-.5h.6c.2 0 .5 0 .7.5l.9 2c.1.3 0 .5-.1.7l-.5.6c-.2.2-.2.4 0 .7a7 7 0 0 0 2.9 2.6c.3.1.5.1.7-.1l.6-.7c.2-.3.5-.3.8-.2l2 .9c.4.2.5.4.5.7a2.6 2.6 0 0 1-2.6 2.3c-1.3 0-3.6-.8-5.5-2.7-1.9-1.9-2.8-4.2-2.8-5.5 0-.5.1-.9.1-1.3z"
        fill={phone}
      />
    </svg>
  );
}

const h2Style: CSSProperties = {
  margin: 0,
  fontWeight: 600,
  fontSize: "clamp(26px,3.6vw,38px)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  textAlign: "center",
};

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  borderRadius: 22,
  padding: "30px 26px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxShadow: "0 8px 22px rgba(122,76,16,0.16)",
  border: "1.5px solid rgba(122,76,16,0.12)",
};

const h3Style: CSSProperties = {
  margin: 0,
  fontWeight: 500,
  fontSize: 21,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const cardTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.6,
  fontWeight: 600,
  color: "#5a4820",
};

const stepBoxStyle = (bg: string): CSSProperties => ({
  width: 64,
  height: 64,
  borderRadius: 14,
  background: bg,
  border: "2.5px solid #2b2118",
  boxShadow: "inset 0 -6px 0 rgba(43,33,24,0.18), 0 6px 14px rgba(122,76,16,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: 32,
  color: "#fff",
});

const SERVICOS = [
  {
    titulo: "Terapia ABA / Modelo Denver",
    texto: "Programas estruturados e baseados em evidências, aplicados de forma lúdica e afetuosa.",
  },
  {
    titulo: "Intervenção precoce",
    texto: "Quanto antes começa o acompanhamento, maiores os ganhos no desenvolvimento da criança.",
  },
  {
    titulo: "Psicoterapia infanto-juvenil",
    texto: "Espaço seguro para crianças e adolescentes desenvolverem emoções e vínculos.",
  },
  {
    titulo: "Equipe multidisciplinar",
    texto: "ABA, fonoaudiologia, terapia ocupacional e psicologia trabalhando juntas pelo mesmo plano.",
  },
];

const PASSOS = [
  {
    cor: "#e07856",
    titulo: "Chame no WhatsApp",
    texto: "Conte um pouco sobre seu filho. Nossa equipe responde com carinho e sem pressa.",
  },
  {
    cor: "#5b9bd5",
    titulo: "Avaliação inicial",
    texto: "Conhecemos a criança e a família para entender necessidades e potenciais.",
  },
  {
    cor: "#6aa84f",
    titulo: "Plano individualizado",
    texto: "Um plano terapêutico só do seu filho, com devolutivas constantes para a família.",
  },
];

export default function LandingPage() {
  return (
    <main
      className={nunito.className}
      style={{
        minHeight: "100vh",
        color: "#2b2118",
        background:
          "radial-gradient(130% 90% at 50% 24%, #fdf4da 0%, #fae3a8 42%, #f6cd72 68%, #efb545 88%, #e9a938 100%)",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes flutua{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
        @media (max-width:640px){ .lp-deco{display:none !important;} }
        .lp-cta{transition:transform .2s ease, box-shadow .2s ease;}
        .lp-cta:hover{transform:translateY(-2px);}
        .lp-fab{transition:transform .2s ease;}
        .lp-fab:hover{transform:scale(1.08);}
        .lp-oswald{font-family:${oswald.style.fontFamily};}
        .lp-vibes{font-family:${greatVibes.style.fontFamily};}
        main a{color:#7a4c10;}
        main a:hover{color:#5c3a0c;}
      `}</style>

      {/* ===================== HERO ===================== */}
      <header
        style={{
          position: "relative",
          maxWidth: 1060,
          margin: "0 auto",
          padding: "56px 24px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 26,
        }}
      >
        <svg
          className="lp-deco"
          width="92"
          height="54"
          viewBox="0 0 92 54"
          style={{ position: "absolute", left: "4%", top: 120, opacity: 0.8 }}
          aria-hidden="true"
        >
          <path d="M4 38 C 22 10, 48 8, 66 20" fill="none" stroke="#2b2118" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M66 20 l -12 -3 m 12 3 l -4 11" fill="none" stroke="#2b2118" strokeWidth="2.6" strokeLinecap="round" />
          <path
            d="M76 14 c 3 -6 10 -4 9 2 c 1 -6 8 -4 7 1 c -1 5 -8 8 -8 8 c 0 0 -9 -5 -8 -11 z"
            fill="none"
            stroke="#2b2118"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            <Girassol size={52} style={{ animation: "flutua 5s ease-in-out infinite" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span
                className="lp-oswald"
                style={{
                  fontWeight: 400,
                  fontSize: "clamp(20px,2.6vw,26px)",
                  letterSpacing: "8px",
                  textTransform: "uppercase",
                  marginLeft: 8,
                }}
              >
                Clínica
              </span>
              <span className="lp-vibes" style={{ fontSize: "clamp(58px,9vw,96px)", lineHeight: 0.9, marginTop: -6 }}>
                Girassóis
              </span>
            </div>
            <Girassol size={38} style={{ marginBottom: 14, animation: "flutua 6s ease-in-out infinite" }} />
          </div>
          <span style={{ fontSize: "clamp(15px,1.8vw,17px)", fontWeight: 600, color: "#6d5426", letterSpacing: "1px" }}>
            Terapia infantil multidisciplinar · Cuiabá – MT
          </span>
        </div>

        <h1
          className="lp-oswald"
          style={{
            margin: 0,
            fontWeight: 600,
            fontSize: "clamp(30px,4.6vw,52px)",
            lineHeight: 1.15,
            textTransform: "uppercase",
            letterSpacing: "1px",
            maxWidth: 760,
          }}
        >
          Cuidado especializado para o desenvolvimento do seu filho
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          {[
            "Clínica especializada em Terapia ABA / Modelo Denver",
            "Intervenção precoce no autismo",
            "Psicoterapia infanto-juvenil",
          ].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>🌻</span>
              <span
                className="lp-oswald"
                style={{
                  fontWeight: 500,
                  fontSize: "clamp(18px,2.4vw,24px)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  textAlign: "left",
                }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <a
            href={WA_HREF}
            target="_blank"
            rel="noopener"
            className="lp-cta"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "#ffffff",
              color: "#2b2118",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "clamp(17px,2.2vw,21px)",
              padding: "18px 34px",
              borderRadius: 999,
              boxShadow: "0 10px 26px rgba(122,76,16,0.28), 0 2px 6px rgba(122,76,16,0.18)",
            }}
          >
            <WhatsIcon size={26} />
            <span>Fale conosco no WhatsApp</span>
          </a>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#6d5426" }}>
            {TELEFONE} · resposta rápida em horário de atendimento
          </span>
        </div>

        <svg
          className="lp-deco"
          width="80"
          height="46"
          viewBox="0 0 80 46"
          style={{ position: "absolute", right: "6%", bottom: 30, opacity: 0.75 }}
          aria-hidden="true"
        >
          <path
            d="M6 10 C 30 34, 52 38, 74 24"
            fill="none"
            stroke="#2b2118"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="1 7"
          />
          <path d="M34 6 c 2 -4 7 -3 6 1 c 1 -4 6 -3 5 1 c -1 3 -5 5 -5 5 c 0 0 -6 -3 -6 -7 z" fill="#2b2118" opacity="0.85" />
        </svg>
      </header>

      {/* abelhinha */}
      <svg
        className="lp-deco"
        width="58"
        height="44"
        viewBox="0 0 58 44"
        style={{ position: "absolute", top: 44, right: "10%", animation: "flutua 4s ease-in-out infinite" }}
        aria-hidden="true"
      >
        <ellipse cx="24" cy="14" rx="9" ry="7" fill="#fff" opacity="0.85" transform="rotate(-24 24 14)" />
        <ellipse cx="38" cy="12" rx="9" ry="7" fill="#fff" opacity="0.85" transform="rotate(20 38 12)" />
        <ellipse cx="30" cy="27" rx="14" ry="10" fill="#f7c948" stroke="#2b2118" strokeWidth="2" />
        <rect x="24" y="17" width="5" height="20" rx="2.5" fill="#2b2118" />
        <rect x="33" y="18" width="5" height="18" rx="2.5" fill="#2b2118" />
        <circle cx="15" cy="25" r="4.5" fill="#2b2118" />
      </svg>

      {/* joaninha */}
      <svg
        className="lp-deco"
        width="44"
        height="40"
        viewBox="0 0 44 40"
        style={{ position: "absolute", top: 490, left: "6%" }}
        aria-hidden="true"
      >
        <circle cx="22" cy="22" r="14" fill="#d94f3d" stroke="#2b2118" strokeWidth="2" />
        <line x1="22" y1="8" x2="22" y2="36" stroke="#2b2118" strokeWidth="2" />
        <circle cx="15" cy="17" r="2.6" fill="#2b2118" />
        <circle cx="29" cy="17" r="2.6" fill="#2b2118" />
        <circle cx="14" cy="27" r="2.6" fill="#2b2118" />
        <circle cx="30" cy="27" r="2.6" fill="#2b2118" />
        <circle cx="22" cy="7" r="5" fill="#2b2118" />
      </svg>

      {/* ===================== SOBRE ===================== */}
      <section
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "40px 24px 30px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          position: "relative",
        }}
      >
        <svg
          className="lp-deco"
          width="46"
          height="40"
          viewBox="0 0 44 40"
          style={{ position: "absolute", right: "4%", top: 0, animation: "flutua 5.5s ease-in-out infinite" }}
          aria-hidden="true"
        >
          <ellipse cx="13" cy="18" rx="10" ry="13" fill="#e88bb6" stroke="#2b2118" strokeWidth="2" transform="rotate(-18 13 18)" />
          <ellipse cx="31" cy="18" rx="10" ry="13" fill="#f2a3c4" stroke="#2b2118" strokeWidth="2" transform="rotate(18 31 18)" />
          <rect x="20" y="8" width="4" height="24" rx="2" fill="#2b2118" />
        </svg>
        <h2 className="lp-oswald" style={h2Style}>
          Sobre a clínica
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(16px,2vw,19px)",
            lineHeight: 1.7,
            fontWeight: 600,
            color: "#4a3a1c",
            textWrap: "pretty",
          }}
        >
          Somos uma clínica multidisciplinar de terapia infantil especializada em autismo. Trabalhamos com intervenção
          precoce e um plano terapêutico individualizado para cada criança, construído por uma equipe que conversa entre
          si — e com você. A família acompanha cada avanço por meio de devolutivas claras e acolhedoras.
        </p>
      </section>

      {/* ===================== SERVIÇOS ===================== */}
      <section
        style={{
          maxWidth: 1060,
          margin: "0 auto",
          padding: "36px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 30,
          alignItems: "center",
        }}
      >
        <h2 className="lp-oswald" style={h2Style}>
          Como podemos ajudar
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
            gap: 22,
            width: "100%",
          }}
        >
          {SERVICOS.map((servico) => (
            <div key={servico.titulo} style={cardStyle}>
              <Girassol size={44} />
              <h3 className="lp-oswald" style={h3Style}>
                {servico.titulo}
              </h3>
              <p style={cardTextStyle}>{servico.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== COMO FUNCIONA ===================== */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "40px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 34,
          alignItems: "center",
          position: "relative",
        }}
      >
        <svg
          className="lp-deco"
          width="90"
          height="50"
          viewBox="0 0 92 54"
          style={{ position: "absolute", right: "2%", top: 24, opacity: 0.7, transform: "scaleX(-1)" }}
          aria-hidden="true"
        >
          <path d="M4 38 C 22 10, 48 8, 66 20" fill="none" stroke="#2b2118" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M66 20 l -12 -3 m 12 3 l -4 11" fill="none" stroke="#2b2118" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <h2 className="lp-oswald" style={h2Style}>
          Como funciona
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: 26,
            width: "100%",
          }}
        >
          {PASSOS.map((passo, i) => (
            <div
              key={passo.titulo}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}
            >
              <div className="lp-oswald" style={stepBoxStyle(passo.cor)}>
                {i + 1}
              </div>
              <h3 className="lp-oswald" style={{ ...h3Style, letterSpacing: undefined }}>
                {passo.titulo}
              </h3>
              <p style={{ ...cardTextStyle, maxWidth: 280 }}>{passo.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== LOCALIZAÇÃO ===================== */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "40px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 30,
          alignItems: "center",
        }}
      >
        <h2 className="lp-oswald" style={h2Style}>
          Onde estamos
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 24,
            width: "100%",
            alignItems: "stretch",
          }}
        >
          <div style={{ ...cardStyle, padding: "30px 28px", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="lp-oswald"
                style={{ fontWeight: 500, fontSize: 17, textTransform: "uppercase", letterSpacing: "1px", color: "#7a4c10" }}
              >
                Endereço
              </span>
              <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.5 }}>
                Av. Portugal, 337 — Jardim Tropical
                <br />
                Cuiabá – MT, 78065-145
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="lp-oswald"
                style={{ fontWeight: 500, fontSize: 17, textTransform: "uppercase", letterSpacing: "1px", color: "#7a4c10" }}
              >
                Horários
              </span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Segunda a sexta</span>
              <span style={{ fontSize: 17, fontWeight: 600, color: "#5a4820" }}>07:00 – 12:00 · 13:00 – 18:00</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="lp-oswald"
                style={{ fontWeight: 500, fontSize: 17, textTransform: "uppercase", letterSpacing: "1px", color: "#7a4c10" }}
              >
                Contato
              </span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{TELEFONE}</span>
              <a href={`mailto:${EMAIL}`} style={{ fontSize: 16, fontWeight: 700 }}>
                {EMAIL}
              </a>
            </div>
          </div>

          <div
            style={{
              borderRadius: 22,
              overflow: "hidden",
              border: "1.5px solid rgba(122,76,16,0.2)",
              boxShadow: "0 8px 22px rgba(122,76,16,0.16)",
              minHeight: 280,
              position: "relative",
            }}
          >
            <iframe
              src={MAPS_EMBED}
              title="Mapa — Clínica Girassóis"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>
      </section>

      {/* ===================== RODAPÉ ===================== */}
      <footer
        style={{
          position: "relative",
          marginTop: 30,
          padding: "50px 24px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <span className="lp-vibes" style={{ fontSize: "clamp(40px,6vw,58px)", lineHeight: 1 }}>
            Vamos conversar?
          </span>
          <a
            href={WA_HREF}
            target="_blank"
            rel="noopener"
            className="lp-cta"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#7a4c10",
              color: "#fff7e6",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "clamp(16px,2vw,19px)",
              padding: "16px 30px",
              borderRadius: 999,
              boxShadow: "0 10px 24px rgba(90,56,10,0.35)",
            }}
          >
            <WhatsIcon size={24} />
            <span>Chamar no WhatsApp · {TELEFONE}</span>
          </a>
        </div>

        {/* brinquedos de madeira */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 30,
            flexWrap: "wrap",
            width: "100%",
            maxWidth: 760,
          }}
        >
          <svg width="150" height="74" viewBox="0 0 150 74" aria-hidden="true">
            <rect x="4" y="26" width="56" height="26" rx="5" fill="#5b9bd5" stroke="#2b2118" strokeWidth="2.4" />
            <rect x="14" y="10" width="20" height="18" rx="4" fill="#e07856" stroke="#2b2118" strokeWidth="2.4" />
            <rect x="42" y="16" width="12" height="10" rx="3" fill="#f7c948" stroke="#2b2118" strokeWidth="2" />
            <circle cx="18" cy="58" r="9" fill="#f7c948" stroke="#2b2118" strokeWidth="2.4" />
            <circle cx="46" cy="58" r="9" fill="#f7c948" stroke="#2b2118" strokeWidth="2.4" />
            <rect x="72" y="34" width="34" height="20" rx="4" fill="#6aa84f" stroke="#2b2118" strokeWidth="2.4" />
            <circle cx="80" cy="60" r="7" fill="#e07856" stroke="#2b2118" strokeWidth="2.2" />
            <circle cx="98" cy="60" r="7" fill="#e07856" stroke="#2b2118" strokeWidth="2.2" />
            <rect x="116" y="30" width="30" height="24" rx="4" fill="#e88bb6" stroke="#2b2118" strokeWidth="2.4" />
            <circle cx="124" cy="60" r="7" fill="#5b9bd5" stroke="#2b2118" strokeWidth="2.2" />
            <circle cx="138" cy="60" r="7" fill="#5b9bd5" stroke="#2b2118" strokeWidth="2.2" />
            <path d="M60 40 h 12 M106 44 h 10" stroke="#2b2118" strokeWidth="2.4" />
          </svg>
          <svg width="120" height="66" viewBox="0 0 120 66" aria-hidden="true">
            <rect x="6" y="30" width="30" height="30" rx="5" fill="#e07856" stroke="#2b2118" strokeWidth="2.4" />
            <text x="21" y="52" textAnchor="middle" fontFamily="Oswald,sans-serif" fontSize="20" fontWeight="600" fill="#fff">
              1
            </text>
            <rect x="44" y="30" width="30" height="30" rx="5" fill="#5b9bd5" stroke="#2b2118" strokeWidth="2.4" />
            <text x="59" y="52" textAnchor="middle" fontFamily="Oswald,sans-serif" fontSize="20" fontWeight="600" fill="#fff">
              2
            </text>
            <rect x="82" y="30" width="30" height="30" rx="5" fill="#6aa84f" stroke="#2b2118" strokeWidth="2.4" />
            <text x="97" y="52" textAnchor="middle" fontFamily="Oswald,sans-serif" fontSize="20" fontWeight="600" fill="#fff">
              3
            </text>
            <rect x="25" y="2" width="30" height="26" rx="5" fill="#f7c948" stroke="#2b2118" strokeWidth="2.4" />
          </svg>
          <svg width="70" height="86" viewBox="0 0 70 86" aria-hidden="true">
            <ellipse cx="35" cy="78" rx="26" ry="7" fill="#c9a25e" stroke="#2b2118" strokeWidth="2.4" />
            <ellipse cx="35" cy="64" rx="24" ry="10" fill="#e07856" stroke="#2b2118" strokeWidth="2.4" />
            <ellipse cx="35" cy="50" rx="20" ry="9" fill="#f7c948" stroke="#2b2118" strokeWidth="2.4" />
            <ellipse cx="35" cy="37" rx="16" ry="8" fill="#6aa84f" stroke="#2b2118" strokeWidth="2.4" />
            <ellipse cx="35" cy="25" rx="12" ry="7" fill="#5b9bd5" stroke="#2b2118" strokeWidth="2.4" />
            <circle cx="35" cy="12" r="8" fill="#e88bb6" stroke="#2b2118" strokeWidth="2.4" />
          </svg>
        </div>

        <div
          style={{
            width: "100%",
            background: "rgba(122,76,16,0.16)",
            borderTop: "1.5px solid rgba(122,76,16,0.25)",
            padding: "18px 24px 22px",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 26px",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "#5a4820" }}>© 2026 Clínica Girassóis · Cuiabá – MT</span>
          <Link href="/privacidade" style={{ fontSize: 14, fontWeight: 700 }}>
            Política de Privacidade
          </Link>
          <a href={`mailto:${EMAIL}`} style={{ fontSize: 14, fontWeight: 700 }}>
            {EMAIL}
          </a>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 700 }}>
            Área restrita
          </Link>
        </div>
      </footer>

      {/* botão flutuante WhatsApp */}
      <a
        href={WA_HREF}
        target="_blank"
        rel="noopener"
        aria-label="Falar no WhatsApp"
        className="lp-fab"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 50,
          width: 62,
          height: 62,
          borderRadius: "50%",
          background: "#4caf50",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 26px rgba(43,33,24,0.35)",
          textDecoration: "none",
        }}
      >
        <WhatsIcon size={34} invert />
      </a>
    </main>
  );
}
