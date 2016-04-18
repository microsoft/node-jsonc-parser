export declare enum ScanError {
    None = 0,
    UnexpectedEndOfComment = 1,
    UnexpectedEndOfString = 2,
    UnexpectedEndOfNumber = 3,
    InvalidUnicode = 4,
    InvalidEscapeCharacter = 5,
}
export declare enum SyntaxKind {
    Unknown = 0,
    OpenBraceToken = 1,
    CloseBraceToken = 2,
    OpenBracketToken = 3,
    CloseBracketToken = 4,
    CommaToken = 5,
    ColonToken = 6,
    NullKeyword = 7,
    TrueKeyword = 8,
    FalseKeyword = 9,
    StringLiteral = 10,
    NumericLiteral = 11,
    LineCommentTrivia = 12,
    BlockCommentTrivia = 13,
    LineBreakTrivia = 14,
    Trivia = 15,
    EOF = 16,
}
/**
 * The scanner object, representing a JSON scanner at a position in the input string.
 */
export interface JSONScanner {
    /**
     * Sets the scan position to a new offset. A call to 'scan' is needed to get the first token.
     */
    setPosition(pos: number): any;
    /**
     * Read the next token. Returns the tolen code.
     */
    scan(): SyntaxKind;
    /**
     * Returns the current scan position, which is after the last read token.
     */
    getPosition(): number;
    /**
     * Returns the last read token.
     */
    getToken(): SyntaxKind;
    /**
     * Returns the last read token value. The value for strings is the decoded string content. For numbers its of type number, for boolean it's true or false.
     */
    getTokenValue(): string;
    /**
     * The start offset of the last read token.
     */
    getTokenOffset(): number;
    /**
     * The length of the last read token.
     */
    getTokenLength(): number;
    /**
     * An error code of the last scan.
     */
    getTokenError(): ScanError;
}
/**
 * Create a JSON scanner on the given text.
 * If ignoreTrivia is set, whitespaces or comments are ignored.
 */
export declare function createScanner(text: string, ignoreTrivia?: boolean): JSONScanner;
/**
 * Takes JSON with JavaScript-style comments and remove
 * them. Optionally replaces every none-newline character
 * of comments with a replaceCharacter
 */
export declare function stripComments(text: string, replaceCh?: string): string;
export declare enum ParseErrorCode {
    InvalidSymbol = 0,
    InvalidNumberFormat = 1,
    PropertyNameExpected = 2,
    ValueExpected = 3,
    ColonExpected = 4,
    CommaExpected = 5,
    CloseBraceExpected = 6,
    CloseBracketExpected = 7,
    EndOfFileExpected = 8,
}
export declare function getParseErrorMessage(errorCode: ParseErrorCode): string;
export declare type NodeType = "object" | "array" | "property" | "string" | "number" | "null";
export interface Node {
    type: NodeType;
    value: any;
    offset: number;
    length: number;
    columnOffset?: number;
}
export interface Location {
    previousNode?: Node;
    segments: string[];
    matches: (segments: string[]) => boolean;
    completeProperty: boolean;
}
/**
 * For a given offset, evaluate the location in the JSON document. Each segment in a location is either a property names or an array accessors.
 */
export declare function getLocation(text: string, position: number): Location;
/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault lolerant as possible, but still return a result.
 * Therefore always check the errors list to find out if the input was valid.
 */
export declare function parse(text: string, errors?: {
    error: ParseErrorCode;
}[]): any;
/**
 * Parses the given text and invokes the visitor functions for each object, array and literal reached.
 */
export declare function visit(text: string, visitor: JSONVisitor): any;
export interface JSONVisitor {
    /**
     * Invoked when an open brace is encountered and an object is started. The offset and length represent the location of the open brace.
     */
    onObjectBegin?: (offset: number, length: number) => void;
    /**
     * Invoked when a property is encountered. The offset and length represent the location of the property name.
     */
    onObjectProperty?: (property: string, offset: number, length: number) => void;
    /**
     * Invoked when a closing brace is encountered and an object is completed. The offset and length represent the location of the closing brace.
     */
    onObjectEnd?: (offset: number, length: number) => void;
    /**
     * Invoked when an open bracket is encountered. The offset and length represent the location of the open bracket.
     */
    onArrayBegin?: (offset: number, length: number) => void;
    /**
     * Invoked when a closing bracket is encountered. The offset and length represent the location of the closing bracket.
     */
    onArrayEnd?: (offset: number, length: number) => void;
    /**
     * Invoked when a literal value is encountered. The offset and length represent the location of the literal value.
     */
    onLiteralValue?: (value: any, offset: number, length: number) => void;
    /**
     * Invoked when a comma or colon separator is encountered. The offset and length represent the location of the separator.
     */
    onSeparator?: (charcter: string, offset: number, length: number) => void;
    /**
     * Invoked on an error.
     */
    onError?: (error: ParseErrorCode, offset: number, length: number) => void;
}
