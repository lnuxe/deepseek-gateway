import { motion } from 'motion/react';

/**
 * Aliased motion components.
 *
 * Using `<motion.div>` directly relies on the bundler rewriting the JSX member
 * expression to the minified import binding — with this Vite/Rollup setup it
 * does not, and the built bundle ends up referencing a bare `motion` that
 * exists nowhere at runtime. Referencing a plain identifier avoids the trap.
 */
export const MDiv = motion.div;
export const MLi = motion.li;
